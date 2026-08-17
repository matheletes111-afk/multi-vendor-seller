"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { MapPin, ExternalLink, Loader2 } from "lucide-react"
import { loadGoogleMapsScript } from "@/lib/google-maps-loader"

export interface LocationDetails {
  lat: number
  lng: number
  addressLine1?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  formattedAddress?: string
}

export interface GoogleMapViewProps {
  lat?: number | null
  lng?: number | null
  address?: string | null
  title?: string | null
  zoom?: number
  className?: string
  height?: string
  interactive?: boolean
  draggable?: boolean
  onLocationChange?: (details: LocationDetails) => void
}

export function GoogleMapView({
  lat = null,
  lng = null,
  address = null,
  title = "Location",
  zoom = 15,
  className = "",
  height = "260px",
  interactive = true,
  draggable = false,
  onLocationChange,
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const numLat = lat != null && !isNaN(Number(lat)) ? Number(lat) : null
  const numLng = lng != null && !isNaN(Number(lng)) ? Number(lng) : null
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(
    numLat != null && numLng != null ? { lat: numLat, lng: numLng } : null
  )

  const onLocationChangeRef = useRef(onLocationChange)
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  const draggableRef = useRef(draggable || Boolean(onLocationChange))
  useEffect(() => {
    draggableRef.current = draggable || Boolean(onLocationChange)
  }, [draggable, onLocationChange])

  // Track coords set internally by marker drag/click — avoid re-running initMap on those
  const internalCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const nLat = lat != null && !isNaN(Number(lat)) ? Number(lat) : null
    const nLng = lng != null && !isNaN(Number(lng)) ? Number(lng) : null
    if (nLat != null && nLng != null) {
      setResolvedCoords({ lat: nLat, lng: nLng })
    }
  }, [lat, lng])

  const renderMap = useCallback(
    (targetLat: number, targetLng: number) => {
      if (!mapRef.current || !window.google?.maps) return

      const center = { lat: targetLat, lng: targetLng }
      const mapOptions = {
        center,
        zoom,
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: interactive,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "simplified" }],
          },
        ],
      }

      const isDraggable = draggableRef.current

      const handlePositionChange = (newLat: number, newLng: number) => {
        // Record internally set coords so initMap doesn't re-run on this prop update
        internalCoordsRef.current = { lat: newLat, lng: newLng }
        setResolvedCoords({ lat: newLat, lng: newLng })

        if (onLocationChangeRef.current) {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: string) => {
              let addressLine1 = ""
              let city = ""
              let state = ""
              let postalCode = ""
              let country = ""
              let formattedAddress = ""

              if (status === "OK" && results?.[0]) {
                formattedAddress = results[0].formatted_address || ""
                let streetNumber = ""
                let route = ""

                for (const comp of results[0].address_components || []) {
                  const types: string[] = comp.types || []
                  if (types.includes("street_number")) streetNumber = comp.long_name
                  if (types.includes("route")) route = comp.long_name
                  if (types.includes("locality") || (!city && types.includes("postal_town"))) city = comp.long_name
                  if (types.includes("administrative_area_level_1")) state = comp.long_name
                  if (types.includes("postal_code")) postalCode = comp.long_name
                  if (types.includes("country")) country = comp.long_name
                }
                addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || formattedAddress
              }

              onLocationChangeRef.current?.({
                lat: newLat,
                lng: newLng,
                addressLine1,
                city,
                state,
                postalCode,
                country,
                formattedAddress,
              })
            })
          } else {
            onLocationChangeRef.current?.({ lat: newLat, lng: newLng })
          }
        }
      }

      if (!mapInstanceRef.current) {
        const map = new window.google.maps.Map(mapRef.current, mapOptions)
        mapInstanceRef.current = map

        const marker = new window.google.maps.Marker({
          position: center,
          map,
          title: title || address || "Location",
          animation: window.google.maps.Animation.DROP,
          draggable: isDraggable,
        })
        markerInstanceRef.current = marker

        marker.addListener("dragend", () => {
          const pos = marker.getPosition()
          if (pos) {
            handlePositionChange(pos.lat(), pos.lng())
          }
        })

        if (isDraggable) {
          map.addListener("click", (e: any) => {
            if (e.latLng) {
              const newLat = e.latLng.lat()
              const newLng = e.latLng.lng()
              marker.setPosition({ lat: newLat, lng: newLng })
              handlePositionChange(newLat, newLng)
            }
          })
        }

        if (address || title) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding:6px;font-family:sans-serif;">
                ${title ? `<strong style="font-size:13px;color:#0f172a;display:block;margin-bottom:2px;">${title}</strong>` : ""}
                ${address ? `<span style="font-size:12px;color:#475569;">${address}</span>` : ""}
              </div>
            `,
          })
          marker.addListener("click", () => infoWindow.open(map, marker))
        }
      } else {
        mapInstanceRef.current.setCenter(center)
        mapInstanceRef.current.setZoom(zoom)
        if (markerInstanceRef.current) {
          markerInstanceRef.current.setPosition(center)
          markerInstanceRef.current.setDraggable(isDraggable)
        }
      }
    },
    [address, title, zoom, interactive]
  )

  useEffect(() => {
    let active = true

    const initMap = async () => {
      setLoading(true)
      try {
        await loadGoogleMapsScript(["places"])

        if (!active) return

        const finalLatNum = lat != null && !isNaN(Number(lat)) ? Number(lat) : null
        const finalLngNum = lng != null && !isNaN(Number(lng)) ? Number(lng) : null

        // Skip re-init if these coords came from an internal drag — just update marker
        if (
          mapInstanceRef.current &&
          internalCoordsRef.current &&
          finalLatNum != null &&
          finalLngNum != null &&
          Math.abs(internalCoordsRef.current.lat - finalLatNum) < 0.0000001 &&
          Math.abs(internalCoordsRef.current.lng - finalLngNum) < 0.0000001
        ) {
          internalCoordsRef.current = null
          setLoading(false)
          setError(null)
          return
        }
        internalCoordsRef.current = null

        let finalLat = finalLatNum
        let finalLng = finalLngNum

        if ((finalLat == null || finalLng == null) && address && window.google?.maps?.Geocoder) {
          const geocoder = new window.google.maps.Geocoder()
          const geoRes = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            geocoder.geocode({ address }, (results: any, status: string) => {
              if (status === "OK" && results?.[0]?.geometry?.location) {
                const loc = results[0].geometry.location
                resolve({ lat: loc.lat(), lng: loc.lng() })
              } else {
                resolve(null)
              }
            })
          })
          if (geoRes) {
            finalLat = geoRes.lat
            finalLng = geoRes.lng
            if (active) setResolvedCoords(geoRes)
          }
        }

        if (finalLat != null && finalLng != null && !isNaN(finalLat) && !isNaN(finalLng)) {
          if (active) {
            setLoading(false)
            setError(null)
            renderMap(finalLat, finalLng)
          }
        } else {
          if (active) {
            setError("Address location coordinates unavailable.")
            setLoading(false)
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load Google Map.")
          setLoading(false)
        }
      }
    }

    initMap()

    return () => {
      active = false
    }
  }, [lat, lng, address, renderMap])

  const mapsSearchUrl = resolvedCoords
    ? `https://www.google.com/maps/search/?api=1&query=${resolvedCoords.lat},${resolvedCoords.lng}`
    : address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  const isDraggable = draggable || Boolean(onLocationChange)

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm ${className}`}
      style={{ height }}
    >
      <div ref={mapRef} className="h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-xs">
          <Loader2 className="h-7 w-7 animate-spin text-amber-500 mb-2" />
          <span className="text-xs font-semibold text-slate-500">Loading Map View…</span>
        </div>
      )}

      {!loading && !error && isDraggable && (
        <div className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white shadow-sm pointer-events-none">
          <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
          <span>Drag pin or click map to adjust location</span>
        </div>
      )}

      {!loading && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-50/95">
          <MapPin className="h-8 w-8 text-amber-500 mb-2" />
          <p className="text-xs font-semibold text-slate-700 max-w-xs">{title || address || "Location Preview"}</p>
          <p className="text-[11px] text-slate-400 mt-1">{error}</p>
          {mapsSearchUrl && (
            <a
              href={mapsSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
            >
              <span>View on Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {!loading && !error && mapsSearchUrl && (
        <a
          href={mapsSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-xl bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-slate-800 shadow-md border border-white/40 hover:bg-white transition-colors"
        >
          <span>Open Map</span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
        </a>
      )}
    </div>
  )
}
