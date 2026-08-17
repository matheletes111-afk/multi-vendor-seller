"use client"

import { useEffect, useRef, useState } from "react"
import { Search, MapPin, Loader2 } from "lucide-react"
import { Input } from "@/ui/input"
import { loadGoogleMapsScript } from "@/lib/google-maps-loader"

export interface StructuredAddress {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  lat: number | null
  lng: number | null
  formattedAddress: string
}

interface GoogleAddressAutocompleteProps {
  placeholder?: string
  defaultValue?: string
  className?: string
  id?: string
  onAddressSelect: (address: StructuredAddress) => void
}

export function GoogleAddressAutocomplete({
  placeholder = "Search location / address with Google Maps…",
  defaultValue = "",
  className = "",
  id = "google-address-autocomplete",
  onAddressSelect,
}: GoogleAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const listenerRef = useRef<any>(null)
  const onAddressSelectRef = useRef(onAddressSelect)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep latest callback ref without triggering re-initialization
  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect
  }, [onAddressSelect])

  useEffect(() => {
    let active = true
    setLoading(true)

    loadGoogleMapsScript(["places"])
      .then(() => {
        if (!active || !inputRef.current) return
        setLoading(false)

        if (!autocompleteRef.current && window.google?.maps?.places) {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            fields: ["geometry", "formatted_address", "address_components", "name"],
          })
          autocompleteRef.current = autocomplete

          const listener = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace()
            if (!place || (!place.geometry && !place.address_components)) return

            let streetNumber = ""
            let route = ""
            let sublocality = ""
            let city = ""
            let state = ""
            let postalCode = ""
            let country = ""

            if (place.address_components) {
              for (const comp of place.address_components) {
                const types: string[] = comp.types || []

                if (types.includes("street_number")) streetNumber = comp.long_name
                if (types.includes("route")) route = comp.long_name
                if (types.includes("sublocality_level_1") || types.includes("sublocality") || types.includes("neighborhood")) {
                  sublocality = comp.long_name
                }

                if (types.includes("locality")) {
                  city = comp.long_name
                } else if (!city && types.includes("postal_town")) {
                  city = comp.long_name
                } else if (!city && (types.includes("sublocality_level_1") || types.includes("sublocality"))) {
                  city = comp.long_name
                } else if (!city && types.includes("administrative_area_level_2")) {
                  city = comp.long_name
                } else if (!city && types.includes("neighborhood")) {
                  city = comp.long_name
                }

                if (types.includes("administrative_area_level_1")) {
                  state = comp.long_name
                }
                if (types.includes("postal_code")) {
                  postalCode = comp.long_name
                }
                if (types.includes("country")) {
                  country = comp.long_name
                }
              }
            }

            const addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || place.name || place.formatted_address || ""
            const formattedAddress = place.formatted_address || place.name || ""
            const lat = place.geometry?.location ? place.geometry.location.lat() : null
            const lng = place.geometry?.location ? place.geometry.location.lng() : null

            onAddressSelectRef.current?.({
              addressLine1,
              addressLine2: sublocality,
              city,
              state,
              postalCode,
              country,
              lat,
              lng,
              formattedAddress,
            })
          })
          listenerRef.current = listener
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "Failed to load Google Maps.")
          setLoading(false)
        }
      })

    return () => {
      active = false
      if (listenerRef.current && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listenerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (inputRef.current && defaultValue !== undefined) {
      if (inputRef.current.value !== defaultValue && document.activeElement !== inputRef.current) {
        inputRef.current.value = defaultValue || ""
      }
    }
  }, [defaultValue])

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0 pointer-events-none" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`pl-9 pr-9 ${className}`}
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-amber-500" />
        ) : (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0 pointer-events-none" />
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
