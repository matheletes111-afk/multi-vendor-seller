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
  Bell,
  BellOff,
  Info,
  Smartphone,
  Laptop,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
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

export interface LiveRiderDevice {
  platform?: string
  deviceModel?: string | null
  userAgent?: string | null
  deviceId?: string | null
  lastActiveAt?: string | null
  createdAt?: string | null
}

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
  onboardingCompleted?: boolean
  deviceTokensCount?: number
  devices?: LiveRiderDevice[]
  operationalStatus: "FREE" | "ON_DELIVERY" | "OFFLINE"
  telemetry: {
    latitude: number | null
    longitude: number | null
    heading: number
    speed: number
    lastLocationUpdate: string | null
    isRecent?: boolean
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

export function formatDeviceName(dev?: LiveRiderDevice | null): string {
  if (!dev) return "Registered Device"
  if (typeof dev === "string") return dev

  let model = dev.deviceModel?.trim()

  if (!model && dev.userAgent && typeof dev.userAgent === "string") {
    const match = dev.userAgent.match(/\(([^)]+)\)/)
    if (match && match[1]) {
      const inner = match[1].trim()
      if (inner.includes("Windows")) model = "Windows PC"
      else if (inner.includes("Macintosh") || inner.includes("Mac OS")) model = "Mac"
      else if (inner.includes("Linux")) model = "Linux PC"
      else {
        model = inner.split(";")[0].trim()
      }
    }
  }

  const platformRaw = (dev.platform || "").toLowerCase()
  let platformLabel = ""
  if (platformRaw.includes("android")) platformLabel = "Android"
  else if (platformRaw.includes("ios")) platformLabel = "iOS"
  else if (platformRaw.includes("web")) platformLabel = "Web"
  else if (platformRaw) platformLabel = platformRaw.toUpperCase()

  if (model && platformLabel) {
    if (model.toLowerCase().includes(platformLabel.toLowerCase())) {
      return model
    }
    return `${model} (${platformLabel})`
  }

  if (model) return model
  if (platformLabel) return `${platformLabel} Device`
  if (dev.deviceId) return `Device ${dev.deviceId.slice(0, 8)}`
  return "Registered Device"
}

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
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedZone, setSelectedZone] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "FREE" | "ON_DELIVERY" | "OFFLINE">("ALL")
  const [selectedRider, setSelectedRider] = useState<LiveRiderItem | null>(null)
  const [selectedDeviceModalRider, setSelectedDeviceModalRider] = useState<LiveRiderItem | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap")
  const [mobileView, setMobileView] = useState<"split" | "map" | "fleet" | "guide">("split")

  const handleMobileViewChange = (view: "split" | "map" | "fleet" | "guide") => {
    setMobileView(view)
    if (view === "split" || view === "map") {
      setTimeout(() => {
        if (mapInstanceRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize")
          if (selectedRider?.telemetry.latitude != null && selectedRider?.telemetry.longitude != null) {
            mapInstanceRef.current.panTo({
              lat: selectedRider.telemetry.latitude,
              lng: selectedRider.telemetry.longitude,
            })
          } else {
            recenterFleet()
          }
        }
      }, 150)
    }
  }

  // ── 1. Fetch Fleet Data ───────────────────────────────────────────────────
  const fetchFleet = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      const res = await fetch("/api/admin/riders/live-track")
      const data = await res.json()
      if (res.ok && data.success) {
        setRiders(data.riders || [])
        setStats(data.stats || { total: 0, free: 0, onDelivery: 0, offline: 0, withGps: 0 })
        if (typeof data.pendingOnboardingCount === "number") {
          setPendingOnboardingCount(data.pendingOnboardingCount)
        }
        setLastSyncTime(new Date())
      }
    } catch (err) {
      console.error("[LiveTrack] Failed to fetch fleet data:", err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Auto-collapse sidebar on mobile screen on initial load
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  // Expose global handlers for InfoWindow clicks
  useEffect(() => {
    if (typeof window === "undefined") return

    ;(window as any).__toggleLiveTrackRiderDevices = (riderId: string) => {
      const el = document.getElementById(`infowindow-devices-${riderId}`)
      const arrow = document.getElementById(`push-arrow-${riderId}`)
      if (el) {
        const isHidden = el.style.display === "none" || !el.style.display
        el.style.display = isHidden ? "block" : "none"
        if (arrow) {
          arrow.innerText = isHidden ? "▲" : "▼"
        }
      }
    }

    ;(window as any).__openDeviceModal = (riderId: string) => {
      const found = riders.find((r) => r.id === riderId)
      if (found) {
        setSelectedDeviceModalRider(found)
      }
    }

    return () => {
      delete (window as any).__toggleLiveTrackRiderDevices
      delete (window as any).__openDeviceModal
    }
  }, [riders])

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

      let matchedRiderObj: LiveRiderItem | null = null

      setRiders((prevRiders) => {
        const updated = prevRiders.map((r) => {
          if (r.id === riderId || r.userId === riderId) {
            matchedRiderObj = {
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
            return matchedRiderObj
          }
          return r
        })
        return updated
      })

      // Real-time update for Selected Rider HUD Card if currently selected
      setSelectedRider((prev) => {
        if (prev && (prev.id === riderId || prev.userId === riderId)) {
          return {
            ...prev,
            isOnline: true,
            telemetry: {
              ...prev.telemetry,
              latitude,
              longitude,
              heading: heading || prev.telemetry.heading,
              speed: speed != null ? speed : prev.telemetry.speed,
              lastLocationUpdate: new Date().toISOString(),
            },
          }
        }
        return prev
      })

      // Smoothly reposition marker on Google Maps and rotate heading arrow
      let marker = markersRef.current.get(riderId)
      if (!marker && matchedRiderObj) {
        marker = markersRef.current.get((matchedRiderObj as LiveRiderItem).id)
      }
      if (marker && window.google?.maps) {
        const newPos = new window.google.maps.LatLng(latitude, longitude)
        marker.setPosition(newPos)
        if (matchedRiderObj) {
          const iconUrl = createVehicleSvgIcon(
            (matchedRiderObj as LiveRiderItem).primaryVehicleType,
            (matchedRiderObj as LiveRiderItem).operationalStatus,
            heading
          )
          marker.setIcon({
            url: iconUrl,
            scaledSize: new window.google.maps.Size(46, 46),
            anchor: new window.google.maps.Point(23, 23),
          })
        }
      }
    }

    // Real-time rider online/offline status change from socket server
    // Emitted when a rider calls POST /mobileapi/rider/status (Go Online / Go Offline)
    // or when a device switch occurs (2-phone scenario)
    function onRiderStatusChanged(payload: {
      riderId: string
      isOnline: boolean
      switchedDevice?: boolean
      previousDeviceId?: string
      activeDeviceId?: string
      timestamp?: number
    }) {
      const { riderId, isOnline: newIsOnline } = payload
      if (!riderId) return

      setRiders((prevRiders) =>
        prevRiders.map((r) => {
          if (r.id === riderId || r.userId === riderId) {
            const isBusy = r.operationalStatus === "ON_DELIVERY"
            const nowMs = Date.now()
            const lastUpdateMs = r.telemetry.lastLocationUpdate
              ? new Date(r.telemetry.lastLocationUpdate).getTime()
              : 0
            const isRecent = lastUpdateMs > 0 && (nowMs - lastUpdateMs) < 10 * 60 * 1000

            let newStatus: "FREE" | "ON_DELIVERY" | "OFFLINE" = "OFFLINE"
            if (newIsOnline) {
              if (isBusy) {
                newStatus = "ON_DELIVERY"
              } else if (isRecent) {
                newStatus = "FREE"
              } else {
                newStatus = "OFFLINE"
              }
            }

            return {
              ...r,
              isOnline: newIsOnline && (isRecent || isBusy),
              operationalStatus: newStatus,
            }
          }
          return r
        })
      )

      setSelectedRider((prev) => {
        if (!prev || (prev.id !== riderId && prev.userId !== riderId)) return prev
        const isBusy = prev.operationalStatus === "ON_DELIVERY"
        const nowMs = Date.now()
        const lastUpdateMs = prev.telemetry.lastLocationUpdate
          ? new Date(prev.telemetry.lastLocationUpdate).getTime()
          : 0
        const isRecent = lastUpdateMs > 0 && (nowMs - lastUpdateMs) < 10 * 60 * 1000

        let newStatus: "FREE" | "ON_DELIVERY" | "OFFLINE" = "OFFLINE"
        if (newIsOnline) {
          if (isBusy) {
            newStatus = "ON_DELIVERY"
          } else if (isRecent) {
            newStatus = "FREE"
          } else {
            newStatus = "OFFLINE"
          }
        }

        return {
          ...prev,
          isOnline: newIsOnline && (isRecent || isBusy),
          operationalStatus: newStatus,
        }
      })
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("rider:moved", onRiderMoved)
    socket.on("rider:status_changed", onRiderStatusChanged)

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
      socket.off("rider:status_changed", onRiderStatusChanged)
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
    const hasDevices = (rider.deviceTokensCount || 0) > 0
    const devicesList = rider.devices || []
    const devicesListHtml = devicesList.length > 0
      ? devicesList
          .map((d) => {
            const name = formatDeviceName(d)
            const isIos = (d.platform || "").toLowerCase().includes("ios")
            const isAndroid = (d.platform || "").toLowerCase().includes("android")
            const icon = isIos ? "🍏" : isAndroid ? "🤖" : "💻"
            const timeStr = d.lastActiveAt
              ? new Date(d.lastActiveAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Active"
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: #ffffff; border: 1px solid #e9d5ff; border-radius: 6px; font-size: 10px; margin-bottom: 3px;">
                <span style="font-weight: 600; color: #4c1d95; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
                  ${icon} ${name}
                </span>
                <span style="font-size: 9px; color: #7e22ce; margin-left: 6px; flex-shrink: 0;">${timeStr}</span>
              </div>
            `
          })
          .join("")
      : `<div style="font-size: 10px; color: #64748b;">${rider.deviceTokensCount || 0} registered notification device(s)</div>`

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

        <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${statusBg}; color: ${statusText};">
            ${statusLabel}
          </span>
          <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; background: ${rider.onboardingCompleted ? "#eff6ff" : "#fffbeb"}; color: ${rider.onboardingCompleted ? "#1d4ed8" : "#b45309"}; border: 1px solid ${rider.onboardingCompleted ? "#bfdbfe" : "#fde68a"};">
            ${rider.onboardingCompleted ? "✓ Onboarded" : "⏳ Pending Profile"}
          </span>
          <span
            id="push-badge-${rider.id}"
            ${hasDevices ? `onclick="window.__toggleLiveTrackRiderDevices && window.__toggleLiveTrackRiderDevices('${rider.id}')"` : ""}
            style="display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; background: ${hasDevices ? "#faf5ff" : "#f1f5f9"}; color: ${hasDevices ? "#7e22ce" : "#64748b"}; border: 1px solid ${hasDevices ? "#e9d5ff" : "#e2e8f0"}; ${hasDevices ? "cursor: pointer;" : ""}"
            title="${hasDevices ? `Click to view ${devicesList.length || rider.deviceTokensCount} registered device name(s)` : "No notification token registered"}"
          >
            ${hasDevices ? `🔔 Notification (${rider.deviceTokensCount})` : "🔕 No Notification"}
            ${hasDevices ? `<span id="push-arrow-${rider.id}" style="font-size: 8px; opacity: 0.75;">▼</span>` : ""}
          </span>
        </div>

        ${
          hasDevices
            ? `
          <div
            id="infowindow-devices-${rider.id}"
            style="display: none; margin-bottom: 8px; padding: 6px 8px; background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 8px; font-size: 10px; color: #581c87;"
          >
            <div style="font-weight: 700; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
              <span>📱 Registered Devices (${devicesList.length || rider.deviceTokensCount})</span>
              <button
                type="button"
                onclick="window.__openDeviceModal && window.__openDeviceModal('${rider.id}')"
                style="background: none; border: none; font-size: 9.5px; color: #7e22ce; text-decoration: underline; cursor: pointer; padding: 0;"
              >
                More details ↗
              </button>
            </div>
            <div>
              ${devicesListHtml}
            </div>
          </div>
          `
            : ""
        }

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
    // On mobile screens, switch to split view so map and rider card are in focus
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      if (mobileView === "fleet" || mobileView === "guide") {
        setMobileView("split")
      }
      setSidebarOpen(false)
      setTimeout(() => {
        const mapEl = document.getElementById("live-track-map-container")
        if (mapEl) {
          mapEl.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }, 100)
    }
    const lat = rider.telemetry.latitude
    const lng = rider.telemetry.longitude
    if (lat != null && lng != null && mapInstanceRef.current && window.google?.maps) {
      setTimeout(() => {
        if (mapInstanceRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize")
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
      }, 150)
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

  // ── Sub-components / Render Helpers for Clean Reusability ────────────────
  const renderComplianceNotice = () => (
    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border-b shrink-0 text-[10.5px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
      <div className="leading-tight">
        <span className="font-bold">Onboarded Fleet Only:</span> Only riders who finished full onboarding ({riders.length}) appear on map & receive delivery orders.
        {pendingOnboardingCount > 0 && (
          <span className="block mt-0.5 text-muted-foreground text-[9.5px]">
            ({pendingOnboardingCount} pending onboarding riders are excluded from live map & offers).
          </span>
        )}
      </div>
    </div>
  )

  const renderColorGuide = () => (
    <div className="p-3 bg-muted/40 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          Color & Status Guide
        </span>
        <span className="text-[9px] font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
          Status Legend
        </span>
      </div>

      {/* 3 Main Operational Status Cards */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* Green / Free */}
        <div className="p-1.5 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
          <div className="flex items-center gap-1 font-bold text-[10px] text-emerald-800 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            Free
          </div>
          <p className="text-[8.5px] text-muted-foreground mt-0.5 leading-tight">
            Online & ready for orders
          </p>
        </div>

        {/* Blue / Delivering */}
        <div className="p-1.5 rounded-xl border bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50">
          <div className="flex items-center gap-1 font-bold text-[10px] text-blue-800 dark:text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
            Delivering
          </div>
          <p className="text-[8.5px] text-muted-foreground mt-0.5 leading-tight">
            Carrying active order
          </p>
        </div>

        {/* Gray / Offline */}
        <div className="p-1.5 rounded-xl border bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1 font-bold text-[10px] text-slate-700 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            Offline
          </div>
          <p className="text-[8.5px] text-muted-foreground mt-0.5 leading-tight">
            App closed / inactive
          </p>
        </div>
      </div>

      {/* Sub-Condition Indicators */}
      <div className="pt-1.5 border-t border-border/60 flex flex-wrap items-center gap-1 text-[9px]">
        <span className="inline-flex items-center gap-1 bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
          <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
          Live GPS
        </span>
        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
          <MapPin className="w-2.5 h-2.5 text-slate-400" />
          No GPS
        </span>
        <span className="inline-flex items-center gap-1 bg-blue-100/80 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
          <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
          Onboarded
        </span>
        <span className="inline-flex items-center gap-1 bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
          <Clock className="w-2.5 h-2.5 text-amber-600" />
          Pending Form
        </span>
        <span className="inline-flex items-center gap-1 bg-purple-100/80 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
          <Bell className="w-2.5 h-2.5 text-purple-600" />
          Notification Ready
        </span>
      </div>
    </div>
  )

  const renderSelectedRiderCard = (rider: LiveRiderItem, onClose?: () => void) => (
    <div className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/20 shadow-xs shrink-0">
            <AvatarImage src={rider.profileImage || ""} />
            <AvatarFallback className="bg-blue-600 text-white font-bold text-xs sm:text-sm">
              {rider.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">{rider.name}</h4>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <Phone className="w-3 h-3 text-blue-600 shrink-0" />
              {rider.phone ? `${rider.phoneCountryCode} ${rider.phone}` : "No phone"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] sm:text-[11px] font-bold py-0.5",
              rider.operationalStatus === "FREE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                : rider.operationalStatus === "ON_DELIVERY"
                ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {rider.operationalStatus === "FREE"
              ? "Free"
              : rider.operationalStatus === "ON_DELIVERY"
              ? "Delivering"
              : "Offline"}
          </Badge>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rider Telemetry & Vehicle Details */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t text-xs">
        <div className="p-1.5 sm:p-2 rounded-xl bg-muted/50">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">Vehicle</span>
          <span className="font-semibold text-foreground truncate block text-[11px] sm:text-xs">
            {rider.vehicleName || rider.primaryVehicleType}
          </span>
        </div>
        <div className="p-1.5 sm:p-2 rounded-xl bg-muted/50">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">Plate No.</span>
          <span className="font-semibold text-foreground truncate block text-[11px] sm:text-xs">
            {rider.vehicleNumber || "N/A"}
          </span>
        </div>
        <div className="p-1.5 sm:p-2 rounded-xl bg-muted/50">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">Live Speed</span>
          <span className="font-semibold text-blue-600 block text-[11px] sm:text-xs">
            {Math.round(rider.telemetry.speed || 0)} km/h
          </span>
        </div>
      </div>

      {/* Active Delivery Order Context */}
      {rider.operationalStatus === "ON_DELIVERY" && rider.activeDelivery && (
        <div className="mt-2.5 p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs">
          <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-100">
            <span className="flex items-center gap-1.5 truncate">
              <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Order #{rider.activeDelivery.orderNumber || "Active"}
            </span>
            <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-blue-600 text-white border-none shrink-0">
              {rider.activeDelivery.assignmentStatus}
            </Badge>
          </div>
          <div className="mt-1 text-[11px] text-blue-900/80 dark:text-blue-200/80 line-clamp-2">
            <span><strong>Store:</strong> {rider.activeDelivery.sellerName}</span> • <span><strong>Dest:</strong> {rider.activeDelivery.customerAddress || rider.activeDelivery.customerCity || "Customer location"}</span>
          </div>
        </div>
      )}

      {/* Profile & Capability Status Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {rider.telemetry.latitude != null ? (
          rider.operationalStatus !== "OFFLINE" && rider.telemetry.isRecent !== false ? (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live GPS Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1" title={rider.telemetry.lastLocationUpdate ? `Last updated: ${new Date(rider.telemetry.lastLocationUpdate).toLocaleString()}` : "Offline"}>
              <MapPin className="w-3 h-3 text-slate-400" />
              Offline (Last GPS)
            </Badge>
          )
        ) : (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            No GPS Signal Yet
          </Badge>
        )}

        {rider.onboardingCompleted ? (
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Profile Onboarded
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Profile Form
          </Badge>
        )}

        {(rider.deviceTokensCount || 0) > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedDeviceModalRider(rider)}
            className="cursor-pointer"
            title="Click to view registered device names"
          >
            <Badge variant="outline" className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 flex items-center gap-1 transition-colors">
              <Bell className="w-3 h-3 text-purple-600" />
              Notification Ready ({rider.deviceTokensCount})
            </Badge>
          </button>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border flex items-center gap-1 opacity-70">
            <BellOff className="w-3 h-3" />
            No Notification Token
          </Badge>
        )}
      </div>

      {/* No GPS helper note */}
      {rider.telemetry.latitude == null && (
        <div className="mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>Rider has not sent live GPS coordinates yet. Once the rider opens the Rider App with Location enabled, their live pin will appear on map.</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t">
        {rider.phone && (
          <a
            href={`tel:${rider.phoneCountryCode}${rider.phone}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </a>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => focusOnRider(rider)}
          className="flex-1 rounded-xl text-xs gap-1.5 h-8"
        >
          <Navigation className="w-3.5 h-3.5 text-blue-600" />
          Center on Map
        </Button>
      </div>
    </div>
  )

  const renderRiderList = () => {
    if (filteredRiders.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
          <Bike className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
          <p className="font-semibold text-foreground">No onboarded riders match filters.</p>
          {pendingOnboardingCount > 0 && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-left leading-relaxed">
              Note: {pendingOnboardingCount} riders are currently pending onboarding and are excluded from the live tracking map until their registration is completed.
            </p>
          )}
        </div>
      )
    }

    return filteredRiders.map((rider) => {
      const isSelected = selectedRider?.id === rider.id
      const hasCoordinates = rider.telemetry.latitude != null && rider.telemetry.longitude != null
      const isLiveGps = hasCoordinates && rider.operationalStatus !== "OFFLINE" && rider.telemetry.isRecent !== false
      const hasPush = (rider.deviceTokensCount || 0) > 0
      const isOnboarded = rider.onboardingCompleted

      return (
        <div
          key={rider.id}
          onClick={() => focusOnRider(rider)}
          className={cn(
            "p-3 rounded-2xl border transition-all cursor-pointer bg-card hover:bg-muted/50 space-y-2",
            isSelected && "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs ring-1 ring-blue-500/20"
          )}
        >
          {/* Top Row: Avatar with status dot, Name, Vehicle & Operational Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src={rider.profileImage || ""} />
                  <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-bold">
                    {rider.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {/* Status Dot */}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                    rider.operationalStatus === "FREE"
                      ? "bg-emerald-500"
                      : rider.operationalStatus === "ON_DELIVERY"
                      ? "bg-blue-500 animate-pulse"
                      : "bg-slate-400"
                  )}
                />
              </div>

              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground leading-tight truncate">
                  {rider.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {rider.vehicleName || rider.primaryVehicleType}
                  {rider.vehicleNumber ? ` • ${rider.vehicleNumber}` : ""}
                </div>
              </div>
            </div>

            {/* Operational Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold py-0.5 shrink-0",
                rider.operationalStatus === "FREE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : rider.operationalStatus === "ON_DELIVERY"
                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {rider.operationalStatus === "FREE"
                ? "Free"
                : rider.operationalStatus === "ON_DELIVERY"
                ? "Delivering"
                : "Offline"}
            </Badge>
          </div>

          {/* Condition & Capability Badges (GPS, Onboarding, Push) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* GPS Indicator */}
            {isLiveGps ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 px-1.5 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Live GPS
              </span>
            ) : hasCoordinates ? (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md"
                title={`Offline / Stale GPS. Last update: ${rider.telemetry.lastLocationUpdate ? new Date(rider.telemetry.lastLocationUpdate).toLocaleString() : "N/A"}`}
              >
                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                Last GPS
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[9px] text-muted-foreground bg-muted border border-dashed border-border px-1.5 py-0.5 rounded-md"
                title="Rider has not sent GPS telemetry coordinates yet"
              >
                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                No GPS
              </span>
            )}

            {/* Onboarding Profile Status */}
            {isOnboarded ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-300/40 px-1.5 py-0.5 rounded-md">
                <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                Onboarded
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40 px-1.5 py-0.5 rounded-md"
                title="Rider hasn't completed their documents/onboarding steps"
              >
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                Pending Form
              </span>
            )}

            {/* Notification Token */}
            {hasPush ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedDeviceModalRider(rider)
                }}
                className="inline-flex items-center gap-1 text-[9px] font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300/40 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                title={`${rider.deviceTokensCount} notification token(s) registered. Click to view device names.`}
              >
                <Bell className="w-2.5 h-2.5 text-purple-600" />
                <span>Notification Ready ({rider.deviceTokensCount})</span>
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[9px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-md opacity-80"
                title="No notification token found; rider has not logged into mobile app"
              >
                <BellOff className="w-2.5 h-2.5 opacity-60" />
                No Notification
              </span>
            )}
          </div>

          {/* Active Delivery Context (if delivering) */}
          {rider.operationalStatus === "ON_DELIVERY" && rider.activeDelivery && (
            <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-[10px] space-y-1">
              <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-200">
                <span className="flex items-center gap-1 truncate">
                  <Package className="w-3 h-3 text-blue-600 shrink-0" />
                  #{rider.activeDelivery.orderNumber || "Active Order"}
                </span>
                <span className="text-[9px] uppercase px-1 py-0.2 bg-blue-600 text-white rounded font-semibold">
                  {rider.activeDelivery.assignmentStatus.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-[10px] text-blue-900/80 dark:text-blue-300/80 truncate">
                Store: {rider.activeDelivery.sellerName}
              </div>
            </div>
          )}

          {/* Telemetry & Zones */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t">
            <span className="flex items-center gap-1 truncate max-w-[150px]" title={rider.selectedZones.join(", ")}>
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">
                {rider.selectedZones[0] || "General Zone"}
                {rider.selectedZones.length > 1 ? ` (+${rider.selectedZones.length - 1})` : ""}
              </span>
            </span>
            <span className="font-semibold text-foreground flex items-center gap-1 shrink-0">
              <Gauge className="w-3 h-3 text-blue-600" />
              {hasCoordinates ? `${Math.round(rider.telemetry.speed || 0)} km/h` : "No Signal"}
            </span>
          </div>
        </div>
      )
    })
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 p-2 sm:p-3 bg-slate-950/90 backdrop-blur-md"
          : "min-h-[100dvh] md:h-[calc(100dvh-70px)] md:min-h-[520px] p-2.5 sm:p-4 lg:p-6 overflow-y-auto md:overflow-hidden"
      )}
    >
      {/* ── TOP HEADER & METRIC CARDS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 sm:pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Live Rider Fleet Tracking
                </h1>
                {socketConnected ? (
                  <Badge variant="outline" className="text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    WebSocket Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] sm:text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 py-0.5">
                    <RefreshCw className="w-3 h-3 animate-spin inline-block" />
                    Polling (12s)
                  </Badge>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                Real-time GPS telemetry, speed monitoring, and zonal route tracking across delivery operations.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFleet()}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-8 sm:h-9 bg-card"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Sync Now</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={recenterFleet}
            className="rounded-xl text-xs gap-1.5 h-8 sm:h-9 bg-card"
            title="Recenter Map to Fleet"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Fit Fleet</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-xl h-8 w-8 sm:h-9 sm:w-9 bg-card"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ── MOBILE VIEW SWITCHER (SEGMENTED CONTROL) ── */}
      <div className="md:hidden flex items-center p-1 bg-muted/80 dark:bg-muted/40 rounded-2xl border gap-1 shrink-0 mb-2.5 shadow-2xs">
        <button
          type="button"
          onClick={() => handleMobileViewChange("split")}
          className={cn(
            "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1",
            mobileView === "split"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>📱</span>
          <span>All (Split)</span>
        </button>
        <button
          type="button"
          onClick={() => handleMobileViewChange("map")}
          className={cn(
            "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1",
            mobileView === "map"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>🗺️</span>
          <span>Map</span>
        </button>
        <button
          type="button"
          onClick={() => handleMobileViewChange("fleet")}
          className={cn(
            "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1",
            mobileView === "fleet"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>🚴</span>
          <span>Fleet ({filteredRiders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleMobileViewChange("guide")}
          className={cn(
            "flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1",
            mobileView === "guide"
              ? "bg-background text-foreground shadow-xs ring-1 ring-border font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>ℹ️</span>
          <span>Legend</span>
        </button>
      </div>

      {/* ── KPI METRICS RIBBON ── */}
      <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-2 pb-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x sm:overflow-visible shrink-0">
        {/* Total Fleet */}
        <div
          onClick={() => setSelectedStatus("ALL")}
          className={cn(
            "p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-blue-400 shrink-0 snap-start min-w-[130px] sm:min-w-0 flex-1",
            selectedStatus === "ALL" && "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
          )}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground font-medium">
            <span>Onboarded Fleet</span>
            <Bike className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-foreground mt-0.5">{stats.total}</div>
        </div>

        {/* Free / Available */}
        <div
          onClick={() => setSelectedStatus("FREE")}
          className={cn(
            "p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-emerald-400 shrink-0 snap-start min-w-[130px] sm:min-w-0 flex-1",
            selectedStatus === "FREE" && "border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20"
          )}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Free / Available</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{stats.free}</div>
        </div>

        {/* On Delivery */}
        <div
          onClick={() => setSelectedStatus("ON_DELIVERY")}
          className={cn(
            "p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-blue-400 shrink-0 snap-start min-w-[130px] sm:min-w-0 flex-1",
            selectedStatus === "ON_DELIVERY" && "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
          )}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium">
            <span>On Delivery</span>
            <Package className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{stats.onDelivery}</div>
        </div>

        {/* Offline */}
        <div
          onClick={() => setSelectedStatus("OFFLINE")}
          className={cn(
            "p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer bg-card shadow-2xs hover:border-slate-400 shrink-0 snap-start min-w-[130px] sm:min-w-0 flex-1",
            selectedStatus === "OFFLINE" && "border-slate-600 bg-slate-100/50 dark:bg-slate-900/40"
          )}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-medium">
            <span>Offline</span>
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{stats.offline}</div>
        </div>

        {/* GPS Telemetry Live */}
        <div className="shrink-0 snap-start min-w-[140px] sm:min-w-0 flex-1 col-span-2 sm:col-span-1 lg:col-span-1 p-2.5 sm:p-3 rounded-2xl border bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <span>Active GPS Signals</span>
            <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
            {stats.withGps} <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN MAP & FLEET CONTENT CONTAINER (RESPONSIVE) ── */}
      <div
        className={cn(
          "relative flex-1 transition-all",
          // Desktop: Flex row containing map on left and sidebar on right
          "md:flex md:flex-row md:rounded-2xl md:sm:rounded-3xl md:overflow-hidden md:border md:bg-card md:shadow-sm md:min-h-0",
          // Mobile: Vertical stack
          "max-md:flex max-md:flex-col max-md:space-y-3 max-md:min-h-0"
        )}
      >
        {/* ── GOOGLE MAP CONTAINER (SINGLE DOM INSTANCE) ── */}
        <div
          id="live-track-map-container"
          className={cn(
            "relative transition-all",
            // Desktop: fills the left pane
            "md:flex-1 md:h-full md:w-full md:min-w-0",
            // Mobile:
            mobileView === "map"
              ? "max-md:h-[calc(100dvh-230px)] max-md:min-h-[420px] max-md:w-full max-md:rounded-2xl max-md:overflow-hidden max-md:border max-md:shadow-sm"
              : mobileView === "split"
              ? "max-md:h-[330px] max-md:w-full max-md:rounded-2xl max-md:overflow-hidden max-md:border max-md:shadow-sm max-md:shrink-0"
              : "max-md:hidden"
          )}
        >
          {/* FLOATING TOP HUD CONTROLS */}
          <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-auto z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl border shadow-lg max-w-[calc(100%-16px)] sm:max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[120px] sm:min-w-[180px] sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search rider..."
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
              <SelectTrigger className="h-8 text-xs rounded-xl w-28 sm:w-40 bg-background">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="ALL">All Zones</SelectItem>
                {LOCATION_ZONES.map((z) => (
                  <SelectItem key={z.zone} value={z.zone}>
                    {z.zone}
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
                  "px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors",
                  mapType === "roadmap" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setMapType("hybrid")}
                className={cn(
                  "px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-colors",
                  mapType === "hybrid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Satellite
              </button>
            </div>
          </div>

          {/* FLOATING SELECTED RIDER HUD CARD (Desktop or mobile 'map' mode) */}
          {selectedRider && (
            <div
              className={cn(
                "absolute z-20 animate-in slide-in-from-bottom-4 duration-200",
                // Desktop: bottom left of map
                "md:bottom-4 md:left-4 md:max-w-sm md:w-96",
                // Mobile: only visible floating if in full 'map' view
                mobileView === "map" ? "max-md:bottom-3 max-md:left-2 max-md:right-2" : "max-md:hidden"
              )}
            >
              {renderSelectedRiderCard(selectedRider, () => setSelectedRider(null))}
            </div>
          )}

          {/* Mobile Bottom Quick Switcher (when in map-only mode) */}
          {mobileView === "map" && (
            <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
              <Button
                size="sm"
                onClick={() => handleMobileViewChange("split")}
                className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 gap-1.5 border border-white/20 backdrop-blur-xs"
              >
                <Bike className="w-3.5 h-3.5" />
                View All {filteredRiders.length} Fleet & Legend ↓
              </Button>
            </div>
          )}

          {/* GOOGLE MAP CANVAS */}
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        {/* ── DESKTOP SIDEBAR TOGGLE BUTTON ── */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-background border shadow-md p-1.5 rounded-l-xl text-muted-foreground hover:text-foreground"
          title={sidebarOpen ? "Collapse Fleet List" : "Expand Fleet List"}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* ── DESKTOP SIDEBAR (md:flex) ── */}
        <div
          className={cn(
            "hidden md:flex h-full border-l bg-card flex-col transition-all duration-300 shrink-0",
            sidebarOpen ? "w-80 sm:w-[26rem]" : "w-0 overflow-hidden border-l-0"
          )}
        >
          <div className="p-3 sm:p-4 border-b flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-blue-600" />
                Fleet Directory ({filteredRiders.length})
              </h3>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                Showing onboarded active fleet eligible for orders.
              </p>
            </div>
          </div>

          {/* Compliance notice */}
          {renderComplianceNotice()}

          {/* Color Guide */}
          {renderColorGuide()}

          {/* Rider list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {renderRiderList()}
          </div>
        </div>

        {/* ── MOBILE SECTIONS CONTAINER (< md) ── */}
        <div className="md:hidden flex flex-col space-y-3 pb-8">
          {/* Selected Rider Details (In Mobile Split View, rendered cleanly below map) */}
          {mobileView === "split" && selectedRider && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              {renderSelectedRiderCard(selectedRider, () => setSelectedRider(null))}
            </div>
          )}

          {/* Color & Status Guide (Legend) */}
          {(mobileView === "split" || mobileView === "guide") && (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-2xs">
              {renderColorGuide()}
            </div>
          )}

          {/* Compliance Notice */}
          {(mobileView === "split" || mobileView === "fleet" || mobileView === "guide") && (
            <div className="rounded-2xl border overflow-hidden">
              {renderComplianceNotice()}
            </div>
          )}

          {/* Fleet Directory List */}
          {(mobileView === "split" || mobileView === "fleet") && (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-2xs">
              <div className="p-3.5 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-blue-600" />
                    Fleet Directory ({filteredRiders.length})
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    Tap any rider to center on live map.
                  </p>
                </div>
                {mobileView === "fleet" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMobileViewChange("split")}
                    className="h-7 text-xs rounded-xl gap-1 text-blue-600 border-blue-200"
                  >
                    <MapPin className="w-3 h-3" />
                    View Map
                  </Button>
                )}
              </div>

              {/* In mobile fleet view, provide search and zone filter */}
              {mobileView === "fleet" && (
                <div className="p-2.5 border-b bg-muted/20 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search rider name, phone, plate..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl bg-background"
                    />
                  </div>
                  <Select value={selectedZone} onValueChange={handleZoneSelect}>
                    <SelectTrigger className="h-8 text-xs rounded-xl w-32 bg-background">
                      <SelectValue placeholder="Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Zones</SelectItem>
                      {LOCATION_ZONES.map((z) => (
                        <SelectItem key={z.zone} value={z.zone}>{z.zone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-3 space-y-2">
                {renderRiderList()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DEVICE TOKENS MODAL ────────────────────────────────────────── */}
      <Dialog
        open={Boolean(selectedDeviceModalRider)}
        onOpenChange={(open) => {
          if (!open) setSelectedDeviceModalRider(null)
        }}
      >
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div>Registered Notification Devices</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">
                  {selectedDeviceModalRider?.name} ({selectedDeviceModalRider?.phoneCountryCode} {selectedDeviceModalRider?.phone || selectedDeviceModalRider?.email})
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Devices registered to receive real-time order dispatch notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {(!selectedDeviceModalRider?.devices || selectedDeviceModalRider.devices.length === 0) ? (
              <div className="p-6 text-center text-xs text-muted-foreground border rounded-2xl bg-muted/20 space-y-1">
                <BellOff className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-foreground">No Active Devices</p>
                <p>This rider has not logged into the mobile application yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {selectedDeviceModalRider.devices.map((dev, idx) => {
                  const formattedName = formatDeviceName(dev)
                  const isIos = (dev.platform || "").toLowerCase().includes("ios")
                  const isAndroid = (dev.platform || "").toLowerCase().includes("android")

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl border bg-card text-xs flex items-center justify-between gap-3 shadow-2xs hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/70 dark:border-purple-800/60 flex items-center justify-center shrink-0 text-purple-700 dark:text-purple-300 font-bold">
                          {isIos ? (
                            <span className="text-sm">🍏</span>
                          ) : isAndroid ? (
                            <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate text-xs flex items-center gap-1.5">
                            <span className="truncate">{formattedName}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 uppercase font-semibold text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                            >
                              {dev.platform || "Device"}
                            </Badge>
                          </div>
                          {dev.userAgent && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[240px] font-mono mt-0.5">
                              {dev.userAgent}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ready
                        </span>
                        {dev.lastActiveAt && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {new Date(dev.lastActiveAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
