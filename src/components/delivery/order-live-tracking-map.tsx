"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
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
  className?: string
  height?: string
}

// Calculate Haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
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

export function OrderLiveTrackingMap({
  orderId,
  orderNumber,
  orderStatus,
  deliveryAssignments = [],
  shippingAddress,
  destinationLat = null,
  destinationLng = null,
  className = "",
  height = "380px",
}: OrderLiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const riderMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)

  // Find active assignment
  const activeAssignment = deliveryAssignments.find((a) =>
    ["OUT_FOR_DELIVERY", "PICKED_UP", "AT_PICKUP", "ACCEPTED", "OFFERED", "DELIVERED"].includes(
      a.status
    )
  )

  const rider = activeAssignment?.rider
  const riderUser = rider?.user

  // Resolve vehicle type
  const vehicleTypeRaw =
    (Array.isArray(rider?.vehicleTypes) ? rider.vehicleTypes[0] : null) ||
    rider?.vehicleType ||
    "2_WHEELER"
  const vehicleType = String(vehicleTypeRaw).toUpperCase()

  // State
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [lastTelemetry, setLastTelemetry] = useState<{
    lat: number
    lng: number
    heading?: number
    speed?: number
    timestamp?: number
  } | null>(() => {
    if (rider?.currentLatitude && rider?.currentLongitude) {
      return {
        lat: Number(rider.currentLatitude),
        lng: Number(rider.currentLongitude),
        heading: rider.heading != null ? Number(rider.heading) : 0,
        speed: rider.speed != null ? Number(rider.speed) : 0,
        timestamp: rider.lastLocationUpdate ? new Date(rider.lastLocationUpdate).getTime() : Date.now(),
      }
    }
    return null
  })

  const [resolvedDestCoords, setResolvedDestCoords] = useState<{ lat: number; lng: number } | null>(
    destinationLat != null && destinationLng != null
      ? { lat: Number(destinationLat), lng: Number(destinationLng) }
      : null
  )

  // Address string
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

  // ── 1. Create Vehicle Marker SVG for Google Maps ──────────────────────────────
  const createVehicleIcon = useCallback(
    (type: string, heading: number = 0) => {
      if (typeof window === "undefined" || !window.google?.maps) return undefined

      // Generate SVG data URI based on vehicle type
      let iconColor = "#2563eb" // Blue
      let iconSvgPath = ""

      if (type.includes("3_WHEELER") || type.includes("TRICYCLE") || type.includes("KEKE")) {
        iconColor = "#0891b2" // Cyan / Teal
        // Tricycle / Auto-rickshaw icon path
        iconSvgPath = `
          <rect x="12" y="10" width="24" height="26" rx="6" fill="${iconColor}" stroke="#ffffff" stroke-width="2"/>
          <circle cx="16" cy="38" r="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="32" cy="38" r="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="24" cy="12" r="3.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>
          <rect x="16" y="15" width="16" height="10" rx="2" fill="#ffffff" opacity="0.9"/>
        `
      } else if (type.includes("4_WHEELER") || type.includes("CAR") || type.includes("VAN")) {
        iconColor = "#7c3aed" // Violet
        // Car / Van icon path
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
        // 2_WHEELER (Motorbike / Scooter / Bicycle)
        iconColor = "#2563eb" // Blue
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
    },
    []
  )

  // ── 2. Create Destination Pin SVG for Google Maps ─────────────────────────────
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

  // ── 3. Initialize Socket.IO GPS Listener ──────────────────────────────────────
  useEffect(() => {
    if (!orderId) return

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
      
      // Isolate telemetry: If this map is tracking a specific rider, ignore other riders
      const expectedRiderId = activeAssignment?.riderId || activeAssignment?.rider?.id
      if (expectedRiderId && data.riderId && data.riderId !== expectedRiderId) {
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
  }, [orderId, activeAssignment?.riderId, activeAssignment?.rider?.id])

  // ── 4. Geocode Destination Address if needed ──────────────────────────────────
  // Only geocode once - don't include resolvedDestCoords in deps to avoid loop
  useEffect(() => {
    let active = true

    const geocodeDestination = async () => {
      // Skip if already have coords or no address
      if (destinationLat != null && destinationLng != null) return
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullAddress, destinationLat, destinationLng])

  // ── 5. Initialize Google Map on first render ───────────────────────────────────
  useEffect(() => {
    let active = true

    const initMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return

      try {
        await loadGoogleMapsScript(["places"])
        if (!active || !window.google?.maps || mapInstanceRef.current) return

        const rLat = lastTelemetry?.lat ?? (rider?.currentLatitude ? Number(rider.currentLatitude) : null)
        const rLng = lastTelemetry?.lng ?? (rider?.currentLongitude ? Number(rider.currentLongitude) : null)
        const dLat = resolvedDestCoords?.lat ?? (destinationLat ? Number(destinationLat) : null)
        const dLng = resolvedDestCoords?.lng ?? (destinationLng ? Number(destinationLng) : null)

        let center = { lat: 8.484, lng: -13.23 } // Default Sierra Leone center
        if (rLat != null && rLng != null) center = { lat: rLat, lng: rLng }
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
    return () => { active = false }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 6. Update Markers & Polyline on telemetry / destination changes ────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current

    const rLat = lastTelemetry?.lat ?? (rider?.currentLatitude ? Number(rider.currentLatitude) : null)
    const rLng = lastTelemetry?.lng ?? (rider?.currentLongitude ? Number(rider.currentLongitude) : null)
    const dLat = resolvedDestCoords?.lat ?? (destinationLat ? Number(destinationLat) : null)
    const dLng = resolvedDestCoords?.lng ?? (destinationLng ? Number(destinationLng) : null)

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // ── A. Destination Marker ───────────────────────────────────────────────────
    if (dLat != null && dLng != null && !isNaN(dLat) && !isNaN(dLng)) {
      const destPos = { lat: dLat, lng: dLng }
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
          content: `<div style="padding:6px;font-family:sans-serif;max-width:200px;"><strong style="font-size:12px;color:#dc2626;display:block;">📍 Delivery Address</strong><span style="font-size:11px;color:#334155;">${fullAddress || "Customer Destination"}</span></div>`,
        })
        destMarker.addListener("click", () => infoWindow.open(map, destMarker))
      } else {
        destMarkerRef.current.setPosition(destPos)
      }
    }

    // ── B. Rider Marker ─────────────────────────────────────────────────────────
    if (rLat != null && rLng != null && !isNaN(rLat) && !isNaN(rLng)) {
      const riderPos = { lat: rLat, lng: rLng }
      bounds.extend(riderPos)
      hasPoints = true
      const heading = lastTelemetry?.heading || 0
      const icon = createVehicleIcon(vehicleType, heading)

      if (!riderMarkerRef.current) {
        const riderMarker = new window.google.maps.Marker({
          position: riderPos,
          map,
          title: riderUser?.name || "Delivery Rider",
          icon,
          zIndex: 200,
        })
        riderMarkerRef.current = riderMarker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding:6px;font-family:sans-serif;"><strong style="font-size:12px;color:#2563eb;display:block;">🏍️ ${riderUser?.name || "Delivery Rider"}</strong><span style="font-size:11px;color:#475569;">${rider?.vehicleNumber ? `Plate: ${rider.vehicleNumber}` : "In Transit"}</span></div>`,
        })
        riderMarker.addListener("click", () => infoWindow.open(map, riderMarker))
      } else {
        riderMarkerRef.current.setPosition(riderPos)
        if (icon) riderMarkerRef.current.setIcon(icon)
      }
    }

    // ── C. Polyline Rider → Destination ─────────────────────────────────────────
    if (rLat != null && rLng != null && dLat != null && dLng != null) {
      const path = [{ lat: rLat, lng: rLng }, { lat: dLat, lng: dLng }]
      if (!polylineRef.current) {
        polylineRef.current = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map,
        })
      } else {
        polylineRef.current.setPath(path)
      }
    }

    // ── D. Fit Bounds only on first mount (when both points appear), not every update ──
    if (hasPoints && !riderMarkerRef.current) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
    }
  }, [
    lastTelemetry,
    resolvedDestCoords,
    destinationLat,
    destinationLng,
    vehicleType,
    fullAddress,
    rider,
    riderUser,
    createVehicleIcon,
    createDestinationIcon,
  ])

  // Center on Rider action
  const handleCenterRider = () => {
    if (mapInstanceRef.current && lastTelemetry?.lat && lastTelemetry?.lng) {
      mapInstanceRef.current.panTo({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      mapInstanceRef.current.setZoom(16)
    }
  }

  // Fit both rider & destination
  const handleFitRoute = () => {
    if (mapInstanceRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds()
      if (lastTelemetry?.lat && lastTelemetry?.lng) {
        bounds.extend({ lat: lastTelemetry.lat, lng: lastTelemetry.lng })
      }
      if (resolvedDestCoords?.lat && resolvedDestCoords?.lng) {
        bounds.extend({ lat: resolvedDestCoords.lat, lng: resolvedDestCoords.lng })
      }
      mapInstanceRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
    }
  }

  // Calculate live straight-line distance
  const distanceRemainingKm =
    lastTelemetry?.lat != null &&
    lastTelemetry?.lng != null &&
    resolvedDestCoords?.lat != null &&
    resolvedDestCoords?.lng != null
      ? calculateDistanceKm(
          lastTelemetry.lat,
          lastTelemetry.lng,
          resolvedDestCoords.lat,
          resolvedDestCoords.lng
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

  return (
    <div className={cn("space-y-3", className)}>
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-600/10 text-blue-600">
            {renderVehicleIconBadge()}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              Live Rider GPS Tracking
              {orderNumber && <span className="text-muted-foreground font-semibold">({orderNumber})</span>}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {riderUser?.name ? `${riderUser.name} is on the way` : "Real-time delivery telemetry active"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {socketConnected ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry (Socket.IO)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] font-semibold px-2 py-0.5">
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
            <span className="text-xs font-bold tracking-wide">Connecting to GPS Telemetry Stream…</span>
          </div>
        )}

        {/* Error Overlay */}
        {!loading && mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-white">
            <MapPin className="h-10 w-10 text-amber-400 mb-2" />
            <p className="text-sm font-bold">{fullAddress || "Delivery Route"}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{mapError}</p>
          </div>
        )}

        {/* Live HUD Floating Card (Top Left) */}
        {!loading && !mapError && (
          <div className="absolute top-3 left-3 z-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-3 text-white shadow-xl max-w-xs space-y-2 pointer-events-auto">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-2">
              <Avatar className="h-8 w-8 border border-slate-700">
                <AvatarImage src={riderUser?.image || rider?.profileImage || ""} />
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                  {riderUser?.name?.[0] || "R"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-slate-100">{riderUser?.name || "Delivery Rider"}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {rider?.vehicleNumber ? `Plate: ${rider.vehicleNumber}` : "Active Vehicle"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 font-bold block flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-400" /> Speed
                </span>
                <span className="font-extrabold text-xs text-slate-100 tabular-nums">
                  {lastTelemetry?.speed ? `${Math.round(lastTelemetry.speed)} km/h` : "In Transit"}
                </span>
              </div>

              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 font-bold block flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-400" /> Distance
                </span>
                <span className="font-extrabold text-xs text-emerald-400 tabular-nums">
                  {distanceRemainingKm != null ? `${distanceRemainingKm} km` : "Approaching"}
                </span>
              </div>
            </div>
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
              <Navigation className="w-3 h-3 text-blue-600" /> Center Rider
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
