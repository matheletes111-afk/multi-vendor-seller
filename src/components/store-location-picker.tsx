"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { MapPin, Search, X } from "lucide-react"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"

interface LocationResult {
  lat: number
  lng: number
  address: string
}

interface StoreLocationPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  initialAddress?: string | null
  onLocationSelect?: (result: LocationResult) => void
}

declare global {
  interface Window {
    google: any
    initGoogleMaps?: () => void
    _googleMapsLoading?: boolean
  }
}

export function StoreLocationPicker({
  initialLat,
  initialLng,
  initialAddress,
  onLocationSelect,
}: StoreLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)

  const [lat, setLat] = useState<number | null>(initialLat ?? null)
  const [lng, setLng] = useState<number | null>(initialLng ?? null)
  const [address, setAddress] = useState(initialAddress ?? "")
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return

    const defaultCenter = lat && lng ? { lat, lng } : { lat: 8.4657, lng: -13.2317 } // Default to Freetown, Sierra Leone

    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: lat && lng ? 15 : 7,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapInstanceRef.current = map

    const marker = new window.google.maps.Marker({
      position: defaultCenter,
      map,
      draggable: true,
      visible: !!(lat && lng),
      title: "Store Location",
    })
    markerRef.current = marker

    // On marker drag end — reverse geocode
    marker.addListener("dragend", () => {
      const pos = marker.getPosition()
      if (!pos) return
      const newLat = pos.lat()
      const newLng = pos.lng()
      setLat(newLat)
      setLng(newLng)

      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: string) => {
        if (status === "OK" && results[0]) {
          const addr = results[0].formatted_address
          setAddress(addr)
          if (inputRef.current) inputRef.current.value = addr
          onLocationSelect?.({ lat: newLat, lng: newLng, address: addr })
        }
      })
    })

    // Set up Autocomplete
    if (inputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["geometry", "formatted_address", "name"],
      })
      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place.geometry?.location) return

        const newLat = place.geometry.location.lat()
        const newLng = place.geometry.location.lng()
        const addr = place.formatted_address || place.name || ""

        setLat(newLat)
        setLng(newLng)
        setAddress(addr)

        map.setCenter({ lat: newLat, lng: newLng })
        map.setZoom(15)
        marker.setPosition({ lat: newLat, lng: newLng })
        marker.setVisible(true)

        onLocationSelect?.({ lat: newLat, lng: newLng, address: addr })
      })
    }

    setLoaded(true)
  }, [lat, lng, onLocationSelect])

  useEffect(() => {
    const apiKey = process.env.MAP_KEY
    if (!apiKey) {
      setError("Map API key is not configured.")
      return
    }

    if (window.google?.maps) {
      initMap()
      return
    }

    if (window._googleMapsLoading) {
      // Wait for it to load
      window.initGoogleMaps = initMap
      return
    }

    window._googleMapsLoading = true;
    window.initGoogleMaps = () => {
      window._googleMapsLoading = false
      initMap()
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
    script.async = true
    script.defer = true
    script.onerror = () => setError("Failed to load Google Maps.")
    document.head.appendChild(script)

    return () => {
      // cleanup is left to google
    }
  }, [initMap])

  const clearLocation = () => {
    setLat(null)
    setLng(null)
    setAddress("")
    if (inputRef.current) inputRef.current.value = ""
    if (markerRef.current) markerRef.current.setVisible(false)
  }

  return (
    <div className="space-y-3">
      {/* Hidden form inputs picked up by FormData */}
      <input type="hidden" name="storeLat" value={lat ?? ""} />
      <input type="hidden" name="storeLng" value={lng ?? ""} />
      <input type="hidden" name="storeAddress" value={address ?? ""} />

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          defaultValue={address}
          placeholder="Search for your store location…"
          className="w-full pl-9 pr-9 h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {address && (
          <button
            type="button"
            onClick={clearLocation}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Map */}
      {error ? (
        <div className="h-56 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-sm text-red-600">
          {error}
        </div>
      ) : (
        <div
          ref={mapRef}
          className="h-56 w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
          style={{ minHeight: 220 }}
        />
      )}

      {/* Coordinate display */}
      {lat && lng && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100 text-xs text-green-700">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{address || "Selected location"}</span>
          <span className="ml-auto font-mono opacity-70 shrink-0">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </div>
      )}
    </div>
  )
}
