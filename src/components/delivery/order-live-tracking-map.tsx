"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import {
  Bike,
  Car,
  Truck,
  MapPin,
  Navigation,
  Maximize2,
  Compass,
  Gauge,
  Loader2,
  CheckCircle2,
  Store,
  Clock,
} from "lucide-react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { loadGoogleMapsScript } from "@/lib/google-maps-loader"
import { getSocketClient } from "@/lib/socket-client"
import { cn } from "@/lib/utils"

interface OrderLiveTrackingMapProps {
  orderId: string
  orderNumber?: string
  orderStatus?: string
  deliveryAssignments?: any[]
  pickupName?: string | null
  pickupAddress?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  shippingAddress?: {
    fullName?: string | null
    phone?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
  }
  destinationLat?: number | null
  destinationLng?: number | null
  viewerRole?: "admin" | "seller" | "customer" | "rider"
  enableBrowserGps?: boolean
  className?: string
  height?: string
}

type RoutePhase = "pickup" | "dropoff" | "delivered"

interface LatLngLiteral {
  lat: number
  lng: number
}

// Calculate Haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

// Calculate Haversine distance in meters for throttle thresholds
function calculateDistanceMeters(p1: LatLngLiteral, p2: LatLngLiteral): number {
  return calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng) * 1000
}

function toFiniteCoord(val: unknown): number | null {
  if (val == null || val === "") return null
  const num = Number(val)
  return Number.isFinite(num) && !isNaN(num) ? num : null
}

const ASSIGNMENT_PRIORITY = [
  "OUT_FOR_DELIVERY",
  "PICKED_UP",
  "AT_PICKUP",
  "ACCEPTED",
  "OFFERED",
  "DELIVERED",
]

export function OrderLiveTrackingMap({
  orderId,
  orderNumber,
  orderStatus,
  deliveryAssignments = [],
  pickupName = null,
  pickupAddress = null,
  pickupLat = null,
  pickupLng = null,
  shippingAddress,
  destinationLat = null,
  destinationLng = null,
  viewerRole,
  enableBrowserGps = false,
  className = "",
  height = "380px",
}: OrderLiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const riderMarkerRef = useRef<any>(null)
  const pickupMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const directionsServiceRef = useRef<any>(null)
  const directionsReqIdRef = useRef<number>(0)
  const directionsDisabledRef = useRef<boolean>(false)
  const activeDirectionsRef = useRef<{
    phase: RoutePhase
    path: any[]
  } | null>(null)
  const lastDirectionsFetchRef = useRef<{
    phase: RoutePhase
    origin: LatLngLiteral
    target: LatLngLiteral
    timestamp: number
  } | null>(null)
  const prevPhaseRef = useRef<RoutePhase | null>(null)
  const prevTrackingKeyRef = useRef<string | null>(null)
  const latestRiderPosRef = useRef<LatLngLiteral | null>(null)
  const latestTargetPosRef = useRef<LatLngLiteral | null>(null)
  const hasFittedBoundsForPhaseRef = useRef<RoutePhase | null>(null)

  // Pick highest-priority active assignment
  const activeAssignment = useMemo(() => {
    const valid = deliveryAssignments.filter((a) =>
      ASSIGNMENT_PRIORITY.includes(String(a?.status || "").toUpperCase())
    )
    if (valid.length === 0) return null
    return [...valid].sort((a, b) => {
      const idxA = ASSIGNMENT_PRIORITY.indexOf(String(a?.status || "").toUpperCase())
      const idxB = ASSIGNMENT_PRIORITY.indexOf(String(b?.status || "").toUpperCase())
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
    })[0]
  }, [deliveryAssignments])

  const rider = activeAssignment?.rider
  const riderUser = rider?.user
  const assignmentStatus = String(activeAssignment?.status || "").toUpperCase()

  // Resolve vehicle type
  const vehicleTypeRaw =
    (Array.isArray(rider?.vehicleTypes) ? rider.vehicleTypes[0] : null) ||
    rider?.vehicleType ||
    "2_WHEELER"
  const vehicleType = String(vehicleTypeRaw).toUpperCase()

  const isDelivered =
    orderStatus?.toUpperCase() === "DELIVERED" ||
    assignmentStatus === "DELIVERED"

  const isDropoffPhase =
    !isDelivered && ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(assignmentStatus)

  const routePhase: RoutePhase = isDelivered
    ? "delivered"
    : isDropoffPhase
      ? "dropoff"
      : "pickup"

  // Pickup details from props or assignment seller snapshot
  const sellerObj = activeAssignment?.seller || activeAssignment?.order?.seller
  const resolvedPickupName =
    pickupName ||
    sellerObj?.store?.name ||
    sellerObj?.businessInfo?.businessName ||
    "Product Pickup Store"

  const resolvedPickupAddress = useMemo(() => {
    if (pickupAddress && pickupAddress.trim()) return pickupAddress.trim()
    const biz = sellerObj?.businessInfo
    const store = sellerObj?.store
    const bizAddr = [biz?.street, biz?.city, biz?.district, biz?.postalCode].filter(Boolean).join(", ")
    if (bizAddr) return bizAddr
    const storeAddr = [store?.address, store?.city, store?.state, store?.zipCode, store?.country]
      .filter(Boolean)
      .join(", ")
    return storeAddr
  }, [pickupAddress, sellerObj])

  const explicitPickupLat =
    toFiniteCoord(pickupLat) ??
    toFiniteCoord(activeAssignment?.pickupLocation?.latitude) ??
    toFiniteCoord(activeAssignment?.sellerLatitude) ??
    toFiniteCoord(sellerObj?.businessInfo?.latitude) ??
    toFiniteCoord(sellerObj?.store?.lat)

  const explicitPickupLng =
    toFiniteCoord(pickupLng) ??
    toFiniteCoord(activeAssignment?.pickupLocation?.longitude) ??
    toFiniteCoord(activeAssignment?.sellerLongitude) ??
    toFiniteCoord(sellerObj?.businessInfo?.longitude) ??
    toFiniteCoord(sellerObj?.store?.lng)

  const explicitDestLat =
    toFiniteCoord(destinationLat) ??
    toFiniteCoord(activeAssignment?.dropoffLocation?.latitude) ??
    toFiniteCoord(activeAssignment?.order?.shippingLatitude) ??
    toFiniteCoord(activeAssignment?.order?.shippingAddress?.latitude)

  const explicitDestLng =
    toFiniteCoord(destinationLng) ??
    toFiniteCoord(activeAssignment?.dropoffLocation?.longitude) ??
    toFiniteCoord(activeAssignment?.order?.shippingLongitude) ??
    toFiniteCoord(activeAssignment?.order?.shippingAddress?.longitude)

  // State
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [routeMetrics, setRouteMetrics] = useState<{
    distanceText: string | null
    durationText: string | null
    isDrivingRoute: boolean
  } | null>(null)

  const [resolvedPickupCoords, setResolvedPickupCoords] = useState<LatLngLiteral | null>(
    explicitPickupLat != null && explicitPickupLng != null
      ? { lat: explicitPickupLat, lng: explicitPickupLng }
      : null
  )

  const [resolvedDestCoords, setResolvedDestCoords] = useState<LatLngLiteral | null>(
    explicitDestLat != null && explicitDestLng != null
      ? { lat: explicitDestLat, lng: explicitDestLng }
      : null
  )

  // Keep explicit pickup coords synced (and reset when switching seller assignments without explicit coords)
  useEffect(() => {
    if (explicitPickupLat != null && explicitPickupLng != null) {
      setResolvedPickupCoords({ lat: explicitPickupLat, lng: explicitPickupLng })
    } else {
      setResolvedPickupCoords(null)
    }
  }, [explicitPickupLat, explicitPickupLng, activeAssignment?.id])

  // Keep explicit destination coords synced when props change
  useEffect(() => {
    if (explicitDestLat != null && explicitDestLng != null) {
      setResolvedDestCoords({ lat: explicitDestLat, lng: explicitDestLng })
    } else {
      setResolvedDestCoords(null)
    }
  }, [explicitDestLat, explicitDestLng, orderId])

  const getInitialRiderTelemetry = useCallback(() => {
    if (isDelivered && explicitDestLat != null && explicitDestLng != null) {
      return {
        lat: explicitDestLat,
        lng: explicitDestLng,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),
      }
    }
    const lat =
      toFiniteCoord(rider?.currentLatitude) ??
      toFiniteCoord(activeAssignment?.riderLatitudeAtOffer) ??
      (isDropoffPhase ? explicitPickupLat : null)
    const lng =
      toFiniteCoord(rider?.currentLongitude) ??
      toFiniteCoord(activeAssignment?.riderLongitudeAtOffer) ??
      (isDropoffPhase ? explicitPickupLng : null)

    if (lat != null && lng != null) {
      return {
        lat,
        lng,
        heading: rider?.heading != null ? Number(rider.heading) : 0,
        speed: rider?.speed != null ? Number(rider.speed) : 0,
        timestamp: rider?.lastLocationUpdate ? new Date(rider.lastLocationUpdate).getTime() : Date.now(),
      }
    }
    return null
  }, [
    isDelivered,
    isDropoffPhase,
    explicitDestLat,
    explicitDestLng,
    explicitPickupLat,
    explicitPickupLng,
    rider?.currentLatitude,
    rider?.currentLongitude,
    rider?.heading,
    rider?.speed,
    rider?.lastLocationUpdate,
    activeAssignment?.riderLatitudeAtOffer,
    activeAssignment?.riderLongitudeAtOffer,
  ])

  const [lastTelemetry, setLastTelemetry] = useState<{
    lat: number
    lng: number
    heading?: number
    speed?: number
    timestamp?: number
  } | null>(() => getInitialRiderTelemetry())

  // Sync telemetry when parent props update (during active delivery)
  useEffect(() => {
    if (isDelivered) return
    const lat =
      toFiniteCoord(rider?.currentLatitude) ??
      toFiniteCoord(activeAssignment?.riderLatitudeAtOffer) ??
      (isDropoffPhase ? resolvedPickupCoords?.lat ?? explicitPickupLat : null)
    const lng =
      toFiniteCoord(rider?.currentLongitude) ??
      toFiniteCoord(activeAssignment?.riderLongitudeAtOffer) ??
      (isDropoffPhase ? resolvedPickupCoords?.lng ?? explicitPickupLng : null)

    if (lat != null && lng != null) {
      setLastTelemetry((prev) => {
        if (prev && prev.lat === lat && prev.lng === lng) return prev
        // Don't let an older DB snapshot overwrite a fresh live socket/GPS update within the last 20s
        const incomingTime = rider?.lastLocationUpdate ? new Date(rider.lastLocationUpdate).getTime() : 0
        if (prev?.timestamp && prev.timestamp > incomingTime && Date.now() - prev.timestamp < 20000) {
          return prev
        }
        return {
          lat,
          lng,
          heading: rider?.heading != null ? Number(rider.heading) : prev?.heading || 0,
          speed: rider?.speed != null ? Number(rider.speed) : prev?.speed || 0,
          timestamp: incomingTime || Date.now(),
        }
      })
    }
  }, [
    isDelivered,
    isDropoffPhase,
    rider?.currentLatitude,
    rider?.currentLongitude,
    rider?.heading,
    rider?.speed,
    rider?.lastLocationUpdate,
    activeAssignment?.riderLatitudeAtOffer,
    activeAssignment?.riderLongitudeAtOffer,
    resolvedPickupCoords?.lat,
    resolvedPickupCoords?.lng,
    explicitPickupLat,
    explicitPickupLng,
  ])

  // If order is delivered, lock position to destination
  useEffect(() => {
    if (isDelivered && resolvedDestCoords) {
      setLastTelemetry({
        lat: resolvedDestCoords.lat,
        lng: resolvedDestCoords.lng,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),
      })
    }
  }, [isDelivered, resolvedDestCoords])

  // Optional browser GPS watch for Rider Portal view
  useEffect(() => {
    if (!enableBrowserGps || isDelivered || typeof navigator === "undefined" || !navigator.geolocation) {
      return
    }
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    const hasDbRiderCoords =
      toFiniteCoord(rider?.currentLatitude) != null && toFiniteCoord(rider?.currentLongitude) != null

    // On mobile use hardware GPS; on desktop only fallback if DB has no rider coordinates yet
    if (!isMobile && hasDbRiderCoords) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords
        setLastTelemetry({
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
          speed: speed != null && speed >= 0 ? speed * 3.6 : 0,
          timestamp: Date.now(),
        })
      },
      () => {
        // Non-blocking fallback to DB coordinates
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enableBrowserGps, isDelivered, rider?.currentLatitude, rider?.currentLongitude])

  // Destination address string
  const fullAddress = [
    shippingAddress?.addressLine1,
    shippingAddress?.addressLine2,
    shippingAddress?.city,
    shippingAddress?.state,
    shippingAddress?.postalCode,
    shippingAddress?.country,
  ]
    .filter(Boolean)
    .join(", ")

  // ── 1. Create Vehicle Marker SVG ────────────────────────────────────────────
  const createVehicleIcon = useCallback((type: string, heading: number = 0) => {
    if (typeof window === "undefined" || !window.google?.maps) return undefined

    let iconColor = "#2563eb"
    let iconSvgPath = ""

    if (type.includes("3_WHEELER") || type.includes("TRICYCLE") || type.includes("KEKE")) {
      iconColor = "#0891b2"
      iconSvgPath = `
        <rect x="12" y="10" width="24" height="26" rx="6" fill="${iconColor}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="16" cy="38" r="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="32" cy="38" r="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="24" cy="12" r="3.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
        <rect x="16" y="15" width="16" height="10" rx="2" fill="#ffffff" opacity="0.9"/>
      `
    } else if (type.includes("4_WHEELER") || type.includes("CAR") || type.includes("VAN")) {
      iconColor = "#7c3aed"
      iconSvgPath = `
        <rect x="10" y="8" width="28" height="32" rx="7" fill="${iconColor}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="8" cy="14" r="3" fill="#0f172a"/>
        <circle cx="40" cy="14" r="3" fill="#0f172a"/>
        <circle cx="8" cy="34" r="3" fill="#0f172a"/>
        <circle cx="40" cy="34" r="3" fill="#0f172a"/>
        <path d="M 15 16 L 33 16 L 31 25 L 17 25 Z" fill="#ffffff" opacity="0.9"/>
        <circle cx="16" cy="10" r="2" fill="#fde047"/>
        <circle cx="32" cy="10" r="2" fill="#fde047"/>
      `
    } else {
      iconColor = "#2563eb"
      iconSvgPath = `
        <circle cx="24" cy="24" r="18" fill="${iconColor}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="24" cy="24" r="22" fill="${iconColor}" opacity="0.25" />
        <path d="M 24 9 L 29 21 L 19 21 Z" fill="#ffffff" />
        <circle cx="24" cy="27" r="3.5" fill="#ffffff" />
      `
    }

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <g transform="rotate(${heading || 0} 24 24)">
          ${iconSvgPath}
        </g>
      </svg>
    `

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
      scaledSize: new window.google.maps.Size(44, 44),
      anchor: new window.google.maps.Point(22, 22),
    }
  }, [])

  // ── 2. Create Store Pickup Pin SVG ──────────────────────────────────────────
  const createPickupIcon = useCallback(() => {
    if (typeof window === "undefined" || !window.google?.maps) return undefined

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="42" height="48" viewBox="0 0 42 48">
        <path d="M 21 0 C 9.4 0 0 9.4 0 21 C 0 34 18.2 46.2 20 47.4 C 20.6 47.8 21.4 47.8 22 47.4 C 23.8 46.2 42 34 42 21 C 42 9.4 32.6 0 21 0 Z" fill="#d97706" stroke="#ffffff" stroke-width="2"/>
        <rect x="12" y="13" width="18" height="14" rx="2.5" fill="#ffffff"/>
        <path d="M 11 15 L 21 10 L 31 15" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
        <rect x="17" y="20" width="8" height="7" rx="1" fill="#d97706"/>
      </svg>
    `

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
      scaledSize: new window.google.maps.Size(38, 44),
      anchor: new window.google.maps.Point(19, 44),
    }
  }, [])

  // ── 3. Create Destination Pin SVG ───────────────────────────────────────────
  const createDestinationIcon = useCallback(() => {
    if (typeof window === "undefined" || !window.google?.maps) return undefined

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="46" viewBox="0 0 40 46">
        <path d="M 20 0 C 8.95 0 0 8.95 0 20 C 0 32.5 17.5 44.5 19.1 45.6 C 19.6 46 20.4 46 20.9 45.6 C 22.5 44.5 40 32.5 40 20 C 40 8.95 31.05 0 20 0 Z" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
        <circle cx="20" cy="18" r="8" fill="#ffffff"/>
        <circle cx="20" cy="18" r="4.5" fill="#dc2626"/>
      </svg>
    `

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
      scaledSize: new window.google.maps.Size(36, 42),
      anchor: new window.google.maps.Point(18, 42),
    }
  }, [])

  // ── 4. Initialize Socket.IO GPS Listener ────────────────────────────────────
  useEffect(() => {
    if (!orderId || isDelivered) return

    const socket = getSocketClient()

    const handleConnect = () => {
      setSocketConnected(true)
      socket.emit("join_order", { orderId })
    }

    const handleDisconnect = () => {
      setSocketConnected(false)
    }

    const handleRiderMoved = (data: any) => {
      if (!data || data.latitude == null || data.longitude == null) return

      const expectedRiderId = activeAssignment?.riderId || activeAssignment?.rider?.id
      const expectedUserId = activeAssignment?.rider?.userId
      if (
        (expectedRiderId || expectedUserId) &&
        data.riderId &&
        data.riderId !== expectedRiderId &&
        data.riderId !== expectedUserId
      ) {
        return
      }

      const lat = Number(data.latitude)
      const lng = Number(data.longitude)
      if (isNaN(lat) || isNaN(lng)) return

      setLastTelemetry({
        lat,
        lng,
        heading: data.heading != null ? Number(data.heading) : 0,
        speed: data.speed != null ? Number(data.speed) : 0,
        timestamp: data.timestamp || Date.now(),
      })
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("order:rider_moved", handleRiderMoved)

    if (socket.connected) {
      handleConnect()
    } else {
      socket.connect()
    }

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("order:rider_moved", handleRiderMoved)
    }
  }, [
    orderId,
    isDelivered,
    activeAssignment?.riderId,
    activeAssignment?.rider?.id,
    activeAssignment?.rider?.userId,
  ])

  // ── 5. Geocode Pickup Store Address if needed ────────────────────────────────
  useEffect(() => {
    let active = true

    const geocodePickup = async () => {
      if (explicitPickupLat != null && explicitPickupLng != null) return
      if (!resolvedPickupAddress) return

      try {
        await loadGoogleMapsScript(["places"])
        if (!active || !window.google?.maps?.Geocoder) return

        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ address: resolvedPickupAddress }, (results: any, status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.location && active) {
            const loc = results[0].geometry.location
            setResolvedPickupCoords({ lat: loc.lat(), lng: loc.lng() })
          }
        })
      } catch (err) {
        console.error("Pickup geocoding error:", err)
      }
    }

    geocodePickup()
    return () => {
      active = false
    }
  }, [resolvedPickupAddress, explicitPickupLat, explicitPickupLng])

  // ── 6. Geocode Destination Address if needed ─────────────────────────────────
  useEffect(() => {
    let active = true

    const geocodeDestination = async () => {
      if (explicitDestLat != null && explicitDestLng != null) return
      if (!fullAddress) return

      try {
        await loadGoogleMapsScript(["places"])
        if (!active || !window.google?.maps?.Geocoder) return

        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ address: fullAddress }, (results: any, status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.location && active) {
            const loc = results[0].geometry.location
            setResolvedDestCoords({ lat: loc.lat(), lng: loc.lng() })
          }
        })
      } catch (err) {
        console.error("Destination geocoding error:", err)
      }
    }

    geocodeDestination()
    return () => {
      active = false
    }
  }, [fullAddress, explicitDestLat, explicitDestLng])

  // ── 7. Initialize Google Map once ───────────────────────────────────────────
  useEffect(() => {
    let active = true

    const initMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return

      try {
        await loadGoogleMapsScript(["places"])
        if (!active || !window.google?.maps || mapInstanceRef.current) return

        const rLat = lastTelemetry?.lat ?? toFiniteCoord(rider?.currentLatitude)
        const rLng = lastTelemetry?.lng ?? toFiniteCoord(rider?.currentLongitude)
        const pLat = resolvedPickupCoords?.lat ?? explicitPickupLat
        const pLng = resolvedPickupCoords?.lng ?? explicitPickupLng
        const dLat = resolvedDestCoords?.lat ?? explicitDestLat
        const dLng = resolvedDestCoords?.lng ?? explicitDestLng

        let center: LatLngLiteral = { lat: 8.484, lng: -13.23 }
        if (rLat != null && rLng != null) center = { lat: rLat, lng: rLng }
        else if (routePhase === "pickup" && pLat != null && pLng != null) center = { lat: pLat, lng: pLng }
        else if (dLat != null && dLng != null) center = { lat: dLat, lng: dLng }

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "simplified" }] },
          ],
        })
        mapInstanceRef.current = map
        directionsServiceRef.current = new window.google.maps.DirectionsService()
        setLoading(false)
        setMapError(null)
      } catch (err: any) {
        console.error("Live map init error:", err)
        if (active) {
          setMapError(err.message || "Failed to load live Google Map tracking.")
          setLoading(false)
        }
      }
    }

    initMap()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 8. Update Markers, Driving Route / Fallback Polyline & Bounds ───────────
  useEffect(() => {
    if (loading || !mapInstanceRef.current || !window.google?.maps) return

    let active = true
    const map = mapInstanceRef.current

    // Detect phase or assignment transition and reset cached route & viewport fitting cleanly
    const trackingKey = `${activeAssignment?.id || ""}:${routePhase}`
    if (prevTrackingKeyRef.current !== trackingKey) {
      prevTrackingKeyRef.current = trackingKey
      prevPhaseRef.current = routePhase
      activeDirectionsRef.current = null
      lastDirectionsFetchRef.current = null
      hasFittedBoundsForPhaseRef.current = null
      setRouteMetrics(null)
    }

    const rLat =
      lastTelemetry?.lat ??
      toFiniteCoord(rider?.currentLatitude) ??
      toFiniteCoord(activeAssignment?.riderLatitudeAtOffer) ??
      (routePhase === "dropoff" ? resolvedPickupCoords?.lat ?? explicitPickupLat : null)

    const rLng =
      lastTelemetry?.lng ??
      toFiniteCoord(rider?.currentLongitude) ??
      toFiniteCoord(activeAssignment?.riderLongitudeAtOffer) ??
      (routePhase === "dropoff" ? resolvedPickupCoords?.lng ?? explicitPickupLng : null)

    const pLat = resolvedPickupCoords?.lat ?? explicitPickupLat
    const pLng = resolvedPickupCoords?.lng ?? explicitPickupLng
    const dLat = resolvedDestCoords?.lat ?? explicitDestLat
    const dLng = resolvedDestCoords?.lng ?? explicitDestLng

    const riderPos: LatLngLiteral | null =
      rLat != null && rLng != null ? { lat: rLat, lng: rLng } : null
    const pickupPos: LatLngLiteral | null =
      pLat != null && pLng != null ? { lat: pLat, lng: pLng } : null
    const destPos: LatLngLiteral | null =
      dLat != null && dLng != null ? { lat: dLat, lng: dLng } : null

    const activeTarget: LatLngLiteral | null =
      routePhase === "pickup" ? pickupPos : routePhase === "dropoff" ? destPos : null

    latestRiderPosRef.current = riderPos
    latestTargetPosRef.current = activeTarget

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // ── A. Pickup Store Marker (Phase 1: Heading to Store Pickup) ──────────────
    if (routePhase === "pickup" && pickupPos) {
      bounds.extend(pickupPos)
      hasPoints = true

      if (!pickupMarkerRef.current) {
        const pickupMarker = new window.google.maps.Marker({
          position: pickupPos,
          map,
          title: resolvedPickupName,
          icon: createPickupIcon(),
          zIndex: 110,
        })
        pickupMarkerRef.current = pickupMarker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding:6px;font-family:sans-serif;max-width:220px;"><strong style="font-size:12px;color:#d97706;display:block;">🏪 Pickup Store: ${resolvedPickupName}</strong><span style="font-size:11px;color:#334155;">${resolvedPickupAddress || "Seller Pickup Point"}</span></div>`,
        })
        pickupMarker.addListener("click", () => infoWindow.open(map, pickupMarker))
      } else {
        pickupMarkerRef.current.setMap(map)
        pickupMarkerRef.current.setPosition(pickupPos)
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null)
      pickupMarkerRef.current = null
    }

    // ── B. Destination Marker (Phase 2: En Route to Customer + Delivered) ──────
    if ((routePhase === "dropoff" || routePhase === "delivered") && destPos) {
      bounds.extend(destPos)
      hasPoints = true

      if (!destMarkerRef.current) {
        const destMarker = new window.google.maps.Marker({
          position: destPos,
          map,
          title: "Delivery Destination",
          icon: createDestinationIcon(),
          zIndex: 100,
        })
        destMarkerRef.current = destMarker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding:6px;font-family:sans-serif;max-width:220px;"><strong style="font-size:12px;color:#dc2626;display:block;">📍 Delivery Address</strong><span style="font-size:11px;color:#334155;">${fullAddress || "Customer Destination"}</span></div>`,
        })
        destMarker.addListener("click", () => infoWindow.open(map, destMarker))
      } else {
        destMarkerRef.current.setMap(map)
        destMarkerRef.current.setPosition(destPos)
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null)
      destMarkerRef.current = null
    }

    // ── C. Rider Marker ────────────────────────────────────────────────────────
    if (routePhase !== "delivered" && riderPos) {
      bounds.extend(riderPos)
      hasPoints = true
      const heading = lastTelemetry?.heading || 0
      const icon = createVehicleIcon(vehicleType, heading)
      const riderDisplayName =
        viewerRole === "rider" ? "Your Location" : riderUser?.name || "Delivery Rider"

      if (!riderMarkerRef.current) {
        const riderMarker = new window.google.maps.Marker({
          position: riderPos,
          map,
          title: riderDisplayName,
          icon,
          zIndex: 200,
        })
        riderMarkerRef.current = riderMarker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding:6px;font-family:sans-serif;"><strong style="font-size:12px;color:#2563eb;display:block;">🏍️ ${riderDisplayName}</strong><span style="font-size:11px;color:#475569;">${rider?.vehicleNumber ? `Plate: ${rider.vehicleNumber}` : routePhase === "pickup" ? "Heading to Pickup" : "In Transit"}</span></div>`,
        })
        riderMarker.addListener("click", () => infoWindow.open(map, riderMarker))
      } else {
        riderMarkerRef.current.setMap(map)
        riderMarkerRef.current.setPosition(riderPos)
        if (icon) riderMarkerRef.current.setIcon(icon)
      }
    } else if (riderMarkerRef.current) {
      riderMarkerRef.current.setMap(null)
      riderMarkerRef.current = null
    }

    // ── D. Active Polyline (Google Directions Driving Route + Geodesic Fallback)
    const strokeColor = routePhase === "pickup" ? "#4f46e5" : "#2563eb"

    const applyPolyline = (path: any[], geodesic: boolean) => {
      if (!polylineRef.current) {
        polylineRef.current = new window.google.maps.Polyline({
          path,
          geodesic,
          strokeColor,
          strokeOpacity: 0.9,
          strokeWeight: 4.5,
          zIndex: 50,
          map,
        })
      } else {
        polylineRef.current.setOptions({
          strokeColor,
          geodesic,
          strokeOpacity: 0.9,
          strokeWeight: 4.5,
        })
        polylineRef.current.setMap(map)
        polylineRef.current.setPath(path)
      }
    }

    if (routePhase !== "delivered" && riderPos && activeTarget) {
      // Keep existing driving route on screen while rider moves slightly, otherwise show geodesic fallback immediately
      if (activeDirectionsRef.current?.phase === routePhase && activeDirectionsRef.current.path.length > 1) {
        applyPolyline(activeDirectionsRef.current.path, false)
      } else {
        applyPolyline([riderPos, activeTarget], true)
      }

      const lastFetch = lastDirectionsFetchRef.current
      const now = Date.now()
      const shouldFetchDirections =
        !lastFetch ||
        lastFetch.phase !== routePhase ||
        calculateDistanceMeters(lastFetch.target, activeTarget) > 30 ||
        (calculateDistanceMeters(lastFetch.origin, riderPos) >= 45 && now - lastFetch.timestamp >= 8000)

      if (shouldFetchDirections && !directionsDisabledRef.current && directionsServiceRef.current) {
        lastDirectionsFetchRef.current = {
          phase: routePhase,
          origin: riderPos,
          target: activeTarget,
          timestamp: now,
        }
        const reqId = ++directionsReqIdRef.current
        const requestedTrackingKey = trackingKey
        const requestedPhase = routePhase

        directionsServiceRef.current.route(
          {
            origin: riderPos,
            destination: activeTarget,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (!active || reqId !== directionsReqIdRef.current) return
            if (prevTrackingKeyRef.current !== requestedTrackingKey) return

            if (status === "OK" && result?.routes?.[0]?.overview_path?.length > 1) {
              const roadPath = result.routes[0].overview_path
              activeDirectionsRef.current = { phase: requestedPhase, path: roadPath }
              applyPolyline(roadPath, false)

              const leg = result.routes[0].legs?.[0]
              setRouteMetrics({
                distanceText: leg?.distance?.text || null,
                durationText: leg?.duration?.text || null,
                isDrivingRoute: true,
              })
            } else {
              // Avoid repeated doomed API calls if Directions API is disabled on this MAP_KEY
              if (status === "REQUEST_DENIED" || status === "OVER_DAILY_LIMIT") {
                directionsDisabledRef.current = true
              }
              // Automatic fallback using latest coordinates so stale callbacks don't snap backwards
              const currentOrigin = latestRiderPosRef.current ?? riderPos
              const currentDest = latestTargetPosRef.current ?? activeTarget
              activeDirectionsRef.current = null
              if (currentOrigin && currentDest) {
                applyPolyline([currentOrigin, currentDest], true)
              }
              setRouteMetrics(null)
            }
          }
        )
      }
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    // ── E. Fit Bounds once per phase when coordinates are ready ────────────────
    if (hasPoints && hasFittedBoundsForPhaseRef.current !== routePhase) {
      // If active phase needs both endpoints, wait briefly if target isn't geocoded yet unless only 1 point exists
      hasFittedBoundsForPhaseRef.current = routePhase
      map.fitBounds(bounds, { top: 65, bottom: 65, left: 65, right: 65 })
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setZoom(15)
      }
    }

    return () => {
      active = false
    }
  }, [
    loading,
    routePhase,
    lastTelemetry,
    resolvedPickupCoords,
    resolvedDestCoords,
    explicitPickupLat,
    explicitPickupLng,
    explicitDestLat,
    explicitDestLng,
    vehicleType,
    fullAddress,
    resolvedPickupName,
    resolvedPickupAddress,
    rider,
    riderUser,
    activeAssignment?.id,
    activeAssignment?.riderLatitudeAtOffer,
    activeAssignment?.riderLongitudeAtOffer,
    viewerRole,
    createVehicleIcon,
    createPickupIcon,
    createDestinationIcon,
  ])

  // Re-fit bounds automatically when target coordinates finish geocoding
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return
    if (routePhase === "pickup" && resolvedPickupCoords && lastTelemetry) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      bounds.extend(resolvedPickupCoords)
      mapInstanceRef.current.fitBounds(bounds, { top: 65, bottom: 65, left: 65, right: 65 })
    } else if (routePhase === "dropoff" && resolvedDestCoords && lastTelemetry) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      bounds.extend(resolvedDestCoords)
      mapInstanceRef.current.fitBounds(bounds, { top: 65, bottom: 65, left: 65, right: 65 })
    }
    // Only re-frame when resolved geocoded target coords appear for the active phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPickupCoords, resolvedDestCoords, routePhase])

  // Center on Rider / Destination action
  const handleCenterRider = () => {
    if (!mapInstanceRef.current) return
    if (isDelivered && resolvedDestCoords) {
      mapInstanceRef.current.panTo(resolvedDestCoords)
      mapInstanceRef.current.setZoom(16)
    } else if (lastTelemetry?.lat != null && lastTelemetry?.lng != null) {
      mapInstanceRef.current.panTo({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      mapInstanceRef.current.setZoom(16)
    }
  }

  // Fit active route (Rider + Pickup in Phase 1, Rider + Destination in Phase 2)
  const handleFitRoute = () => {
    if (!mapInstanceRef.current || !window.google?.maps) return
    if (isDelivered && resolvedDestCoords) {
      mapInstanceRef.current.panTo(resolvedDestCoords)
      mapInstanceRef.current.setZoom(16)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    let count = 0
    if (lastTelemetry?.lat != null && lastTelemetry?.lng != null) {
      bounds.extend({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      count++
    }
    const target = routePhase === "pickup" ? resolvedPickupCoords : resolvedDestCoords
    if (target?.lat != null && target?.lng != null) {
      bounds.extend(target)
      count++
    }
    if (count > 0) {
      mapInstanceRef.current.fitBounds(bounds, { top: 65, bottom: 65, left: 65, right: 65 })
      if (count === 1) mapInstanceRef.current.setZoom(15)
    }
  }

  const activeTargetForDistance =
    routePhase === "pickup" ? resolvedPickupCoords : routePhase === "dropoff" ? resolvedDestCoords : null

  const straightDistanceRemainingKm =
    lastTelemetry?.lat != null &&
    lastTelemetry?.lng != null &&
    activeTargetForDistance?.lat != null &&
    activeTargetForDistance?.lng != null
      ? calculateDistanceKm(
          lastTelemetry.lat,
          lastTelemetry.lng,
          activeTargetForDistance.lat,
          activeTargetForDistance.lng
        )
      : null

  const renderVehicleIconBadge = () => {
    if (vehicleType.includes("3_WHEELER") || vehicleType.includes("TRICYCLE")) {
      return <Truck className="w-4 h-4 text-cyan-600" />
    }
    if (vehicleType.includes("4_WHEELER") || vehicleType.includes("CAR")) {
      return <Car className="w-4 h-4 text-violet-600" />
    }
    return <Bike className="w-4 h-4 text-blue-600" />
  }

  const riderDisplayLabel =
    viewerRole === "rider" ? riderUser?.name || "You (Rider)" : riderUser?.name || "Delivery Rider"

  const headerTitle =
    routePhase === "delivered"
      ? "Delivery Destination Location"
      : routePhase === "pickup"
        ? "Live Pickup Route Tracking"
        : "Live Delivery Route Tracking"

  const headerSubtitle =
    routePhase === "delivered"
      ? "Parcel has been delivered to customer destination"
      : routePhase === "pickup"
        ? viewerRole === "rider"
          ? `Route from your location to ${resolvedPickupName}`
          : `${riderUser?.name || "Rider"} is heading to ${resolvedPickupName}`
        : viewerRole === "rider"
          ? "Route from your location to customer delivery address"
          : riderUser?.name
            ? `${riderUser.name} is on the way to delivery address`
            : "Real-time delivery telemetry active"

  return (
    <div className={cn("space-y-3", className)}>
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-1.5 rounded-xl",
              isDelivered
                ? "bg-emerald-600/10 text-emerald-600"
                : routePhase === "pickup"
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-blue-600/10 text-blue-600"
            )}
          >
            {isDelivered ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : routePhase === "pickup" ? (
              <Store className="w-4 h-4 text-amber-600" />
            ) : (
              renderVehicleIconBadge()
            )}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              {headerTitle}
              {orderNumber && (
                <span className="text-muted-foreground font-semibold">({orderNumber})</span>
              )}
            </h4>
            <p className="text-[11px] text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {routePhase === "pickup" && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {assignmentStatus === "AT_PICKUP" ? "At Pickup Store" : "Rider → Pickup"}
            </Badge>
          )}
          {routePhase === "dropoff" && (
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Rider → Delivery
            </Badge>
          )}
          {isDelivered ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Delivered
            </Badge>
          ) : socketConnected ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live GPS
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-300 text-[10px] font-semibold px-2 py-0.5"
            >
              GPS Standby
            </Badge>
          )}
        </div>
      </div>

      {/* Map Card Container */}
      <div
        className="relative w-full overflow-hidden rounded-3xl border border-border/80 bg-slate-950 shadow-md"
        style={{ height }}
      >
        {/* Google Map Div */}
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xs text-white">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-2" />
            <span className="text-xs font-bold tracking-wide">Loading Live Route Map…</span>
          </div>
        )}

        {/* Error Overlay */}
        {!loading && mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-white">
            <MapPin className="h-10 w-10 text-amber-400 mb-2" />
            <p className="text-sm font-bold">
              {routePhase === "pickup" ? resolvedPickupAddress || resolvedPickupName : fullAddress || "Delivery Route"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{mapError}</p>
          </div>
        )}

        {/* Live HUD Floating Card (Top Left) */}
        {!loading && !mapError && (
          <div className="absolute top-3 left-3 z-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-3 text-white shadow-xl max-w-[240px] space-y-2 pointer-events-auto">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-2">
              <Avatar className="h-8 w-8 border border-slate-700">
                <AvatarImage src={riderUser?.image || rider?.profileImage || ""} />
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                  {riderDisplayLabel?.[0] || "R"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-slate-100">{riderDisplayLabel}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {routePhase === "pickup"
                    ? `To: ${resolvedPickupName}`
                    : rider?.vehicleNumber
                      ? `Plate: ${rider.vehicleNumber}`
                      : "Active Vehicle"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 font-bold block flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-400" /> Status
                </span>
                <span className="font-extrabold text-xs text-slate-100 tabular-nums">
                  {isDelivered
                    ? "Delivered"
                    : lastTelemetry?.speed
                      ? `${Math.round(lastTelemetry.speed)} km/h`
                      : routePhase === "pickup"
                        ? assignmentStatus === "AT_PICKUP"
                          ? "At Store"
                          : "To Pickup"
                        : "In Transit"}
                </span>
              </div>

              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 font-bold block flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-400" />{" "}
                  {routePhase === "pickup" ? "To Store" : "Distance"}
                </span>
                <span className="font-extrabold text-xs text-emerald-400 tabular-nums">
                  {isDelivered
                    ? "0.0 km"
                    : routeMetrics?.distanceText
                      ? routeMetrics.distanceText
                      : straightDistanceRemainingKm != null
                        ? `${straightDistanceRemainingKm} km`
                        : !lastTelemetry
                          ? "Awaiting GPS"
                          : "Approaching"}
                </span>
              </div>
            </div>

            {!isDelivered && routeMetrics?.durationText && (
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-800/70 border border-slate-700/40 text-[10px] text-slate-200">
                <span className="flex items-center gap-1 text-slate-400 font-semibold">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Est. Drive
                </span>
                <span className="font-bold text-amber-300 tabular-nums">
                  {routeMetrics.durationText}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick Map Controls (Bottom Right) */}
        {!loading && !mapError && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCenterRider}
              className="h-8 text-xs font-bold rounded-xl bg-white/95 text-slate-900 shadow-lg border border-white/40 hover:bg-white gap-1"
            >
              <Navigation
                className={cn("w-3 h-3", isDelivered ? "text-emerald-600" : "text-blue-600")}
              />{" "}
              {isDelivered ? "Center Destination" : viewerRole === "rider" ? "My Location" : "Center Rider"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFitRoute}
              className="h-8 text-xs font-bold rounded-xl bg-white/95 text-slate-900 shadow-lg border border-white/40 hover:bg-white gap-1"
            >
              <Maximize2 className="w-3 h-3 text-slate-600" /> Fit Route
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
