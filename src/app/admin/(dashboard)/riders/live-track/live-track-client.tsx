"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import {
  Bike,
  Car,
  Truck,
  MapPin,
  Navigation,
  Maximize2,
  Minimize2,
  Compass,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Radio,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Package,
  Layers,
  ChevronRight,
  ChevronLeft,
  X,
  Clock,
  Sparkles,
  Store,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { loadGoogleMapsScript } from "@/lib/google-maps-loader"
import { getSocketClient } from "@/lib/socket-client"
import { LOCATION_ZONES } from "@/lib/location-zones"
import { cn } from "@/lib/utils"

// ── Types ───────────────────────────────────────────────────────────────────

export interface LiveRiderItem {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  phoneCountryCode: string
  profileImage: string | null
  vehicleTypes: string[]
  primaryVehicleType: string
  vehicleName: string | null
  vehicleNumber: string | null
  drivingLicenseNo: string | null
  selectedZones: string[]
  selectedLocations: string[]
  isOnline: boolean
  operationalStatus: "FREE" | "ON_DELIVERY" | "OFFLINE"
  telemetry: {
    latitude: number | null
    longitude: number | null
    heading: number
    speed: number
    lastLocationUpdate: string | null
  }
  activeDelivery?: {
    assignmentId: string
    assignmentStatus: string
    orderId?: string
    orderNumber?: string
    orderStatus?: string
    sellerName: string
    sellerAddress: string | null
    sellerLat?: number | null
    sellerLng?: number | null
    customerAddress: string | null
    customerCity: string | null
    destinationLat?: number | null
    destinationLng?: number | null
  } | null
}

interface FleetStats {
  total: number
  free: number
  onDelivery: number
  offline: number
  withGps: number
}

// ── Approximate Coordinates for Sierra Leone / Freetown Zones ───────────────
const ZONE_CENTER_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  "ZONE 1": { lat: 8.355, lng: -13.268, zoom: 13 }, // No. 2 River, Baw Baw, Hamilton, Lakka
  "ZONE 2": { lat: 8.441, lng: -13.272, zoom: 13 }, // Goderich, Lumley, Juba, Malama
  "ZONE 3": { lat: 8.487, lng: -13.275, zoom: 14 }, // Aberdeen, Man O War Bay, Cape Sierra
  "ZONE 4": { lat: 8.482, lng: -13.255, zoom: 14 }, // Wilberforce, Signal Hill, Spur Loop
  "ZONE 5": { lat: 8.468, lng: -13.238, zoom: 14 }, // Hill Station, Leicester, IMATT
  "ZONE 6": { lat: 8.484, lng: -13.234, zoom: 14 }, // Central Freetown, Brookfields, Pademba
  "ZONE 7": { lat: 8.491, lng: -13.218, zoom: 14 }, // Fourah Bay, Mountain Cut, Cline Town
  "ZONE 8": { lat: 8.465, lng: -13.189, zoom: 13 }, // Kissy, Shell, Wellington
  "ZONE 9": { lat: 8.435, lng: -13.155, zoom: 13 }, // Calaba Town, Robis, Allen Town
  "ZONE 10": { lat: 8.385, lng: -13.125, zoom: 12 }, // Waterloo, Hastings, Lumpa
  "PROVINCE - BO": { lat: 7.964, lng: -11.738, zoom: 12 },
  "PROVINCE - KENEMA": { lat: 7.876, lng: -11.189, zoom: 12 },
  "PROVINCE - MAKENI": { lat: 8.883, lng: -12.044, zoom: 12 },
  "PROVINCE - KONO": { lat: 8.653, lng: -10.971, zoom: 12 },
}

const DEFAULT_CENTER = { lat: 8.484, lng: -13.23, zoom: 12 } // Freetown Center

// ── Custom SVG Vehicle Marker Generator ─────────────────────────────────────
function createVehicleSvgIcon(
  vehicleType: string,
  status: "FREE" | "ON_DELIVERY" | "OFFLINE",
  heading: number = 0
): string {
  const normType = String(vehicleType).toUpperCase()
  let ringColor = "#64748b" // gray for offline
  let glowColor = "rgba(100, 116, 139, 0.4)"
  let bgGradient = ["#f8fafc", "#e2e8f0"]

  if (status === "FREE") {
    ringColor = "#10b981" // emerald green
    glowColor = "rgba(16, 185, 129, 0.45)"
    bgGradient = ["#ecfdf5", "#a7f3d0"]
  } else if (status === "ON_DELIVERY") {
    ringColor = "#2563eb" // vibrant royal blue
    glowColor = "rgba(37, 99, 235, 0.45)"
    bgGradient = ["#eff6ff", "#bfdbfe"]
  }

  // Path shapes for vehicle icons
  let vehiclePath = ""
  if (normType.includes("3_WHEELER") || normType.includes("KEKEH") || normType.includes("AUTO")) {
    // 3-Wheeler / Tricycle Kekeh icon
    vehiclePath = `<path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${ringColor}"/>
                   <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${ringColor}"/>
                   <path d="M12 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${ringColor}"/>
                   <path d="M7 17l5 -11l5 11" stroke="${ringColor}" stroke-width="2" stroke-linecap="round"/>
                   <path d="M6 13h12" stroke="${ringColor}" stroke-width="2" stroke-linecap="round"/>`
  } else if (normType.includes("4_WHEELER") || normType.includes("CAR") || normType.includes("VAN")) {
    // 4-Wheeler / Car icon
    vehiclePath = `<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${ringColor}"/>
                   <path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${ringColor}"/>
                   <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6" stroke="${ringColor}" stroke-width="2" stroke-linecap="round" fill="none"/>
                   <path d="M9 11h6" stroke="${ringColor}" stroke-width="1.5"/>`
  } else if (normType.includes("BICYCLE") || normType.includes("CYCLE")) {
    // Bicycle icon
    vehiclePath = `<path d="M5 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" fill="none" stroke="${ringColor}" stroke-width="2"/>
                   <path d="M15 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" fill="none" stroke="${ringColor}" stroke-width="2"/>
                   <path d="M8 17l4 -8l3 4h4" stroke="${ringColor}" stroke-width="2" stroke-linecap="round" fill="none"/>
                   <path d="M12 9l-4 0l-2 -3" stroke="${ringColor}" stroke-width="2" stroke-linecap="round" fill="none"/>`
  } else {
    // 2-Wheeler Motorcycle / Scooter icon (default)
    vehiclePath = `<path d="M5 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" fill="none" stroke="${ringColor}" stroke-width="2"/>
                   <path d="M19 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" fill="none" stroke="${ringColor}" stroke-width="2"/>
                   <path d="M7.5 14h5l4 -4h-4l-2 -3h-3" stroke="${ringColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                   <path d="M10 6.5h2.5" stroke="${ringColor}" stroke-width="2" stroke-linecap="round"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${glowColor}"/>
      </filter>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
    </defs>
    <!-- Background Outer Pin/Circle -->
    <circle cx="24" cy="24" r="21" fill="url(#bgGrad)" stroke="${ringColor}" stroke-width="3" filter="url(#glow)"/>
    
    <!-- Direction Pointer / Heading Arrow -->
    <g transform="rotate(${heading || 0} 24 24)">
      <polygon points="24,3 27,8 21,8" fill="${ringColor}"/>
    </g>

    <!-- Vehicle Icon Centered -->
    <g transform="translate(12, 12) scale(1)">
      ${vehiclePath}
    </g>

    <!-- Pulse Status Indicator Badge -->
    <circle cx="37" cy="11" r="5.5" fill="${ringColor}" stroke="#ffffff" stroke-width="1.8"/>
  </svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function LiveTrackClient() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const infoWindowRef = useRef<any>(null)

  // State
  const [riders, setRiders] = useState<LiveRiderItem[]>([])
  const [stats, setStats] = useState<FleetStats>({ total: 0, free: 0, onDelivery: 0, offline: 0, withGps: 0 })
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedZone, setSelectedZone] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "FREE" | "ON_DELIVERY" | "OFFLINE">("ALL")
  const [selectedRider, setSelectedRider] = useState<LiveRiderItem | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap")

  // ── 1. Fetch Fleet Data ───────────────────────────────────────────────────
  const fetchFleet = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      const res = await fetch("/api/admin/riders/live-track")
      const data = await res.json()
      if (res.ok && data.success) {
        setRiders(data.riders || [])
        setStats(data.stats || { total: 0, free: 0, onDelivery: 0, offline: 0, withGps: 0 })
        setLastSyncTime(new Date())
      }
    } catch (err) {
      console.error("[LiveTrack] Failed to fetch fleet data:", err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchFleet()
  }, [fetchFleet])

  // ── 2. Socket.IO Live Telemetry Stream ────────────────────────────────────
  useEffect(() => {
    const socket = getSocketClient()

    function onConnect() {
      setSocketConnected(true)
      socket.emit("join_fleet")
    }

    function onDisconnect() {
      setSocketConnected(false)
    }

    // Real-time rider location moved event from socket server
    function onRiderMoved(payload: {
      riderId: string
      latitude: number
      longitude: number
      heading?: number
      speed?: number
      timestamp?: number
    }) {
      const { riderId, latitude, longitude, heading = 0, speed = 0 } = payload
      if (!riderId || latitude == null || longitude == null) return

      setRiders((prevRiders) => {
        const updated = prevRiders.map((r) => {
          if (r.id === riderId || r.userId === riderId) {
            return {
              ...r,
              isOnline: true,
              telemetry: {
                ...r.telemetry,
                latitude,
                longitude,
                heading: heading || r.telemetry.heading,
                speed: speed != null ? speed : r.telemetry.speed,
                lastLocationUpdate: new Date().toISOString(),
              },
            }
          }
          return r
        })
        return updated
      })

      // Smoothly reposition marker on Google Maps if initialized
      const marker = markersRef.current.get(riderId)
      if (marker && window.google?.maps) {
        const newPos = new window.google.maps.LatLng(latitude, longitude)
        marker.setPosition(newPos)
      }
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("rider:moved", onRiderMoved)

    if (socket.connected) {
      onConnect()
    } else {
      socket.connect()
    }

    // Periodic background sync every 12 seconds
    const interval = setInterval(() => {
      fetchFleet(true)
    }, 12000)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("rider:moved", onRiderMoved)
      clearInterval(interval)
    }
  }, [fetchFleet])

  // ── 3. Google Maps Initialization ─────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false

    async function initMap() {
      if (!mapContainerRef.current) return
      try {
        await loadGoogleMapsScript(["places"])
        if (isCancelled || !mapContainerRef.current) return

        if (!mapInstanceRef.current && window.google?.maps) {
          const map = new window.google.maps.Map(mapContainerRef.current, {
            center: { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng },
            zoom: DEFAULT_CENTER.zoom,
            mapTypeId: mapType,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
            ],
          })

          infoWindowRef.current = new window.google.maps.InfoWindow({
            disableAutoPan: false,
          })

          mapInstanceRef.current = map
          setMapLoaded(true)
        }
      } catch (err) {
        console.error("[LiveTrack] Failed to load Google Maps:", err)
      }
    }

    initMap()

    return () => {
      isCancelled = true
    }
  }, [])

  // Dynamically update Google Map type when user toggles Roadmap / Satellite
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(mapType)
    }
  }, [mapType])

  // ── 4. Render / Update Markers on Map ─────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current
    const activeRiderIds = new Set<string>()

    // Filter riders according to selected zone & status & search query
    const visibleRiders = riders.filter((r) => {
      if (selectedZone !== "ALL" && !r.selectedZones.includes(selectedZone)) return false
      if (selectedStatus !== "ALL" && r.operationalStatus !== selectedStatus) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = r.name.toLowerCase().includes(query)
        const matchesEmail = r.email.toLowerCase().includes(query)
        const matchesPhone = (r.phone || "").includes(query)
        const matchesPlate = (r.vehicleNumber || "").toLowerCase().includes(query)
        const matchesModel = (r.vehicleName || "").toLowerCase().includes(query)
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesPlate && !matchesModel) return false
      }
      return true
    })

    visibleRiders.forEach((rider) => {
      const lat = rider.telemetry.latitude
      const lng = rider.telemetry.longitude
      if (lat == null || lng == null) return

      activeRiderIds.add(rider.id)
      const latLng = new window.google.maps.LatLng(lat, lng)
      const iconUrl = createVehicleSvgIcon(
        rider.primaryVehicleType,
        rider.operationalStatus,
        rider.telemetry.heading
      )

      let marker = markersRef.current.get(rider.id)

      if (!marker) {
        // Create new marker
        marker = new window.google.maps.Marker({
          position: latLng,
          map,
          title: rider.name,
          icon: {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(46, 46),
            anchor: new window.google.maps.Point(23, 23),
          },
          animation: window.google.maps.Animation.DROP,
        })

        // On Hover: Show quick InfoWindow tooltip
        marker.addListener("mouseover", () => {
          const content = createInfoWindowHtml(rider)
          infoWindowRef.current.setContent(content)
          infoWindowRef.current.open(map, marker)
        })

        // On Click: Select rider and center
        marker.addListener("click", () => {
          setSelectedRider(rider)
          map.panTo(latLng)
          const content = createInfoWindowHtml(rider)
          infoWindowRef.current.setContent(content)
          infoWindowRef.current.open(map, marker)
        })

        markersRef.current.set(rider.id, marker)
      } else {
        // Update existing marker position & icon
        marker.setPosition(latLng)
        marker.setIcon({
          url: iconUrl,
          scaledSize: new window.google.maps.Size(46, 46),
          anchor: new window.google.maps.Point(23, 23),
        })
      }
    })

    // Remove markers that are no longer in visible list
    markersRef.current.forEach((marker, riderId) => {
      if (!activeRiderIds.has(riderId)) {
        marker.setMap(null)
        markersRef.current.delete(riderId)
      }
    })
  }, [riders, mapLoaded, selectedZone, selectedStatus, searchQuery])

  // ── 5. Generate InfoWindow HTML ───────────────────────────────────────────
  function createInfoWindowHtml(rider: LiveRiderItem): string {
    const isFree = rider.operationalStatus === "FREE"
    const isOnDelivery = rider.operationalStatus === "ON_DELIVERY"
    const statusBg = isFree ? "#ecfdf5" : isOnDelivery ? "#eff6ff" : "#f1f5f9"
    const statusText = isFree ? "#065f46" : isOnDelivery ? "#1e40af" : "#475569"
    const statusLabel = isFree ? "🟢 Free & Available" : isOnDelivery ? "🔵 On Delivery" : "⚪ Offline"

    const vehicleTitle = [rider.vehicleName, rider.vehicleNumber].filter(Boolean).join(" • ") || rider.primaryVehicleType

    return `
      <div style="font-family: inherit; max-width: 280px; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #e2e8f0; flex-shrink: 0;">
            ${
              rider.profileImage
                ? `<img src="${rider.profileImage}" style="width: 100%; height: 100%; object-fit: cover;" />`
                : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-weight: bold; color: #475569;">${rider.name.charAt(0)}</div>`
            }
          </div>
          <div>
            <div style="font-weight: 700; font-size: 14px; color: #0f172a; line-height: 1.2;">${rider.name}</div>
            <div style="font-size: 11px; color: #64748b;">${rider.phone ? `${rider.phoneCountryCode} ${rider.phone}` : rider.email}</div>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusBg}; color: ${statusText};">
            ${statusLabel}
          </span>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; font-size: 11px; color: #334155; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Vehicle:</span>
            <span style="font-weight: 600;">${vehicleTitle}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Speed:</span>
            <span style="font-weight: 600;">${Math.round(rider.telemetry.speed || 0)} km/h</span>
          </div>
          ${
            isOnDelivery && rider.activeDelivery
              ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
                  <div style="color: #1e40af; font-weight: 600;">📦 Order #${rider.activeDelivery.orderNumber || "Active"}</div>
                  <div style="color: #64748b; font-size: 10px;">${rider.activeDelivery.sellerName} ➔ ${rider.activeDelivery.customerCity || "Customer"}</div>
                </div>`
              : ""
          }
        </div>
      </div>
    `
  }

  // ── 6. Map Navigation Actions ─────────────────────────────────────────────
  const focusOnRider = (rider: LiveRiderItem) => {
    setSelectedRider(rider)
    const lat = rider.telemetry.latitude
    const lng = rider.telemetry.longitude
    if (lat != null && lng != null && mapInstanceRef.current && window.google?.maps) {
      const latLng = new window.google.maps.LatLng(lat, lng)
      mapInstanceRef.current.panTo(latLng)
      mapInstanceRef.current.setZoom(16)

      const marker = markersRef.current.get(rider.id)
      if (marker && infoWindowRef.current) {
        const content = createInfoWindowHtml(rider)
        infoWindowRef.current.setContent(content)
        infoWindowRef.current.open(mapInstanceRef.current, marker)
      }
    }
  }

  const handleZoneSelect = (zone: string) => {
    setSelectedZone(zone)
    if (zone === "ALL") {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng })
        mapInstanceRef.current.setZoom(DEFAULT_CENTER.zoom)
      }
    } else {
      const zoneCoord = ZONE_CENTER_COORDINATES[zone]
      if (zoneCoord && mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: zoneCoord.lat, lng: zoneCoord.lng })
        mapInstanceRef.current.setZoom(zoneCoord.zoom)
      }
    }
  }

  const recenterFleet = () => {
    if (!mapInstanceRef.current || !window.google?.maps) return
    const ridersWithLocation = riders.filter(
      (r) => r.telemetry.latitude != null && r.telemetry.longitude != null
    )

    if (ridersWithLocation.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      ridersWithLocation.forEach((r) => {
        bounds.extend({ lat: r.telemetry.latitude!, lng: r.telemetry.longitude! })
      })
      mapInstanceRef.current.fitBounds(bounds)
    } else {
      mapInstanceRef.current.panTo({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng })
      mapInstanceRef.current.setZoom(DEFAULT_CENTER.zoom)
    }
  }

  // Filtered riders for sidebar
  const filteredRiders = useMemo(() => {
    return riders.filter((r) => {
      if (selectedZone !== "ALL" && !r.selectedZones.includes(selectedZone)) return false
      if (selectedStatus !== "ALL" && r.operationalStatus !== selectedStatus) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = r.name.toLowerCase().includes(query)
        const matchesEmail = r.email.toLowerCase().includes(query)
        const matchesPhone = (r.phone || "").includes(query)
        const matchesPlate = (r.vehicleNumber || "").toLowerCase().includes(query)
        const matchesModel = (r.vehicleName || "").toLowerCase().includes(query)
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesPlate && !matchesModel) return false
      }
      return true
    })
  }, [riders, selectedZone, selectedStatus, searchQuery])

  return (
    <div
      className={cn(
        "flex flex-col bg-background transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 p-3 bg-slate-950/90 backdrop-blur-md"
          : "h-[calc(100vh-80px)] min-h-[650px] p-4 lg:p-6"
      )}
    >
      {/* ── TOP HEADER & METRIC CARDS ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Live Rider Fleet Tracking
                {socketConnected ? (
                  <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    Real-time WebSocket Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 py-0.5">
                    <RefreshCw className="w-3 h-3 animate-spin inline-block" />
                    Polling Mode (12s)
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">
                Real-time GPS telemetry, speed monitoring, and zonal route tracking across delivery operations.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFleet()}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-9 bg-card"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Sync Now
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={recenterFleet}
            className="rounded-xl text-xs gap-1.5 h-9 bg-card"
            title="Recenter Map to Fleet"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            Fit Fleet
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-xl h-9 w-9 bg-card"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── KPI METRICS RIBBON ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pb-3">
        {/* Total Fleet */}
        <div
          onClick={() => setSelectedStatus("ALL")}
          className={cn(
            "p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-blue-400",
            selectedStatus === "ALL" && "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Fleet</span>
            <Bike className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-bold text-foreground mt-0.5">{stats.total}</div>
        </div>

        {/* Free / Available */}
        <div
          onClick={() => setSelectedStatus("FREE")}
          className={cn(
            "p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-emerald-400",
            selectedStatus === "FREE" && "border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20"
          )}
        >
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Free / Available</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{stats.free}</div>
        </div>

        {/* On Delivery */}
        <div
          onClick={() => setSelectedStatus("ON_DELIVERY")}
          className={cn(
            "p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-blue-400",
            selectedStatus === "ON_DELIVERY" && "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
          )}
        >
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
            <span>On Delivery</span>
            <Package className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{stats.onDelivery}</div>
        </div>

        {/* Offline */}
        <div
          onClick={() => setSelectedStatus("OFFLINE")}
          className={cn(
            "p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-slate-400",
            selectedStatus === "OFFLINE" && "border-slate-600 bg-slate-100/50 dark:bg-slate-900/40"
          )}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Offline</span>
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{stats.offline}</div>
        </div>

        {/* GPS Telemetry Live */}
        <div className="p-3 rounded-2xl border bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <span>Active GPS Signals</span>
            <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          </div>
          <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
            {stats.withGps} <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN MAP & SIDEBAR CONTAINER ────────────────────────────────────── */}
      <div className="relative flex-1 flex rounded-3xl overflow-hidden border bg-card shadow-sm">
        {/* MAP CONTAINER */}
        <div className="relative flex-1 h-full w-full">
          {/* FLOATING TOP-LEFT HUD CONTROLS */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-background/90 dark:bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border shadow-lg max-w-[calc(100%-32px)]">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search rider, phone, plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs rounded-xl bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Zone Filter */}
            <Select value={selectedZone} onValueChange={handleZoneSelect}>
              <SelectTrigger className="h-8 text-xs rounded-xl w-36 sm:w-44 bg-background">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="ALL">All Delivery Zones</SelectItem>
                {LOCATION_ZONES.map((z) => (
                  <SelectItem key={z.zone} value={z.zone}>
                    {z.zone} ({z.regions.length} areas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Map Type Toggle */}
            <div className="flex rounded-xl bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => setMapType("roadmap")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors",
                  mapType === "roadmap" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Roadmap
              </button>
              <button
                type="button"
                onClick={() => setMapType("hybrid")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors",
                  mapType === "hybrid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Satellite
              </button>
            </div>
          </div>

          {/* FLOATING SELECTED RIDER HUD CARD */}
          {selectedRider && (
            <div className="absolute bottom-4 left-4 z-10 max-w-sm w-[calc(100%-32px)] sm:w-96 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl border shadow-xl animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-xs">
                    <AvatarImage src={selectedRider.profileImage || ""} />
                    <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
                      {selectedRider.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-sm font-bold text-foreground leading-tight">{selectedRider.name}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-blue-600" />
                      {selectedRider.phone ? `${selectedRider.phoneCountryCode} ${selectedRider.phone}` : "No phone"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-bold py-0.5",
                      selectedRider.operationalStatus === "FREE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : selectedRider.operationalStatus === "ON_DELIVERY"
                        ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                        : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {selectedRider.operationalStatus === "FREE"
                      ? "Free"
                      : selectedRider.operationalStatus === "ON_DELIVERY"
                      ? "Delivering"
                      : "Offline"}
                  </Badge>
                  <button
                    onClick={() => setSelectedRider(null)}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rider Telemetry & Vehicle Details */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-xs">
                <div className="p-2 rounded-xl bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block">Vehicle</span>
                  <span className="font-semibold text-foreground truncate block">
                    {selectedRider.vehicleName || selectedRider.primaryVehicleType}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block">Plate No.</span>
                  <span className="font-semibold text-foreground truncate block">
                    {selectedRider.vehicleNumber || "N/A"}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-muted/50">
                  <span className="text-[10px] text-muted-foreground block">Live Speed</span>
                  <span className="font-semibold text-blue-600 block">
                    {Math.round(selectedRider.telemetry.speed || 0)} km/h
                  </span>
                </div>
              </div>

              {/* Active Delivery Order Context */}
              {selectedRider.operationalStatus === "ON_DELIVERY" && selectedRider.activeDelivery && (
                <div className="mt-3 p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-100">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-600" />
                      Order #{selectedRider.activeDelivery.orderNumber || "Active"}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-600 text-white border-none">
                      {selectedRider.activeDelivery.assignmentStatus}
                    </Badge>
                  </div>
                  <div className="mt-1.5 text-[11px] text-blue-900/80 dark:text-blue-200/80">
                    <div>
                      <strong>Store:</strong> {selectedRider.activeDelivery.sellerName}
                    </div>
                    <div>
                      <strong>Destination:</strong> {selectedRider.activeDelivery.customerAddress || selectedRider.activeDelivery.customerCity || "Customer location"}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-3 pt-2">
                {selectedRider.phone && (
                  <a
                    href={`tel:${selectedRider.phoneCountryCode}${selectedRider.phone}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Rider
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => focusOnRider(selectedRider)}
                  className="flex-1 rounded-xl text-xs gap-1.5 h-8"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  Focus on Map
                </Button>
              </div>
            </div>
          )}

          {/* GOOGLE MAP CANVAS */}
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        {/* SIDEBAR TOGGLE BUTTON */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-background border shadow-md p-1.5 rounded-l-xl text-muted-foreground hover:text-foreground"
          title={sidebarOpen ? "Collapse Fleet List" : "Expand Fleet List"}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* ── FLEET SIDEBAR PANEL ──────────────────────────────────────────────── */}
        <div
          className={cn(
            "h-full border-l bg-card flex flex-col transition-all duration-300 z-10",
            sidebarOpen ? "w-80 sm:w-96" : "w-0 overflow-hidden border-l-0"
          )}
        >
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-blue-600" />
                Fleet Directory ({filteredRiders.length})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Click any rider to center and inspect telemetry.
              </p>
            </div>
          </div>

          {/* RIDER LIST */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredRiders.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Bike className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                No riders match current filters.
              </div>
            ) : (
              filteredRiders.map((rider) => {
                const isSelected = selectedRider?.id === rider.id
                const hasCoordinates = rider.telemetry.latitude != null && rider.telemetry.longitude != null

                return (
                  <div
                    key={rider.id}
                    onClick={() => focusOnRider(rider)}
                    className={cn(
                      "p-3 rounded-2xl border transition-all cursor-pointer bg-card hover:bg-muted/50",
                      isSelected && "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={rider.profileImage || ""} />
                          <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-bold">
                            {rider.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-foreground leading-tight">{rider.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {rider.vehicleName || rider.primaryVehicleType}
                            {rider.vehicleNumber ? ` • ${rider.vehicleNumber}` : ""}
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold py-0.5",
                          rider.operationalStatus === "FREE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : rider.operationalStatus === "ON_DELIVERY"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                        )}
                      >
                        {rider.operationalStatus === "FREE"
                          ? "Free"
                          : rider.operationalStatus === "ON_DELIVERY"
                          ? "Delivering"
                          : "Offline"}
                      </Badge>
                    </div>

                    {/* Telemetry & Zones */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {rider.selectedZones[0] || "General Zone"}
                      </span>
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-blue-600" />
                        {Math.round(rider.telemetry.speed || 0)} km/h
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
