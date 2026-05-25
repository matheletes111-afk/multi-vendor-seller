"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Badge } from "@/ui/badge"
import {
  Building2,
  Star,
  MapPin,
  Camera,
  X,
  Upload,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Wifi,
  Wind,
  Coffee,
  Utensils,
  Car,
  Tv,
  Waves,
  Dumbbell
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const HOTEL_AMENITIES = [
  { id: "wifi", label: "Wi-Fi", icon: <Wifi className="h-4 w-4" /> },
  { id: "ac", label: "Air Conditioning", icon: <Wind className="h-4 w-4" /> },
  { id: "pool", label: "Swimming Pool", icon: <Waves className="h-4 w-4" /> },
  { id: "gym", label: "Gym", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "restaurant", label: "Restaurant", icon: <Utensils className="h-4 w-4" /> },
  { id: "bar", label: "Bar", icon: <Coffee className="h-4 w-4" /> },
  { id: "room_service", label: "Room Service", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "parking", label: "Parking", icon: <Car className="h-4 w-4" /> },
  { id: "tv", label: "TV", icon: <Tv className="h-4 w-4" /> },
  { id: "breakfast", label: "Breakfast", icon: <Utensils className="h-4 w-4" /> },
]

export function NewHotelClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    starRating: "3",
    checkInPolicy: "14:00",
    checkOutPolicy: "11:00",
    address: "",
    city: "",
    state: "",
    lat: "",
    lng: "",
  })

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])

  // Image State
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [logo, setLogo] = useState<{ file: File; preview: string } | null>(null)
  const [banner, setBanner] = useState<{ file: File; preview: string } | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const addressInputRef = useRef<HTMLInputElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerInstanceRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !(window as any).google) return

    const initialLat = parseFloat(formData.lat) || 8.4657
    const initialLng = parseFloat(formData.lng) || -13.2317
    const defaultCenter = { lat: initialLat, lng: initialLng }

    const map = new (window as any).google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: formData.lat && formData.lng ? 16 : 8,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapInstanceRef.current = map

    const marker = new (window as any).google.maps.Marker({
      position: defaultCenter,
      map,
      draggable: true,
      visible: true,
      title: "Hotel Location",
    })
    markerInstanceRef.current = marker

    // Map click - move marker and fetch address details
    map.addListener("click", (e: any) => {
      const clickLat = e.latLng.lat()
      const clickLng = e.latLng.lng()
      marker.setPosition({ lat: clickLat, lng: clickLng })
      setFormData(prev => ({ ...prev, lat: clickLat.toString(), lng: clickLng.toString() }))

      const geocoder = new (window as any).google.maps.Geocoder()
      geocoder.geocode({ location: { lat: clickLat, lng: clickLng } }, (results: any, status: string) => {
        if (status === "OK" && results[0]) {
          const addr = results[0].formatted_address
          setFormData(prev => ({ ...prev, address: addr }))
          if (addressInputRef.current) addressInputRef.current.value = addr

          let city = ""
          let state = ""
          for (const comp of results[0].address_components) {
            if (comp.types.includes("locality")) city = comp.long_name
            else if (comp.types.includes("administrative_area_level_1")) state = comp.long_name
            else if (!city && comp.types.includes("administrative_area_level_2")) city = comp.long_name
          }
          if (city) setFormData(prev => ({ ...prev, city }))
          if (state) setFormData(prev => ({ ...prev, state }))
        }
      })
    })

    // Drag marker - update coordinates and fetch address details
    marker.addListener("dragend", () => {
      const pos = marker.getPosition()
      if (!pos) return
      const dragLat = pos.lat()
      const dragLng = pos.lng()
      setFormData(prev => ({ ...prev, lat: dragLat.toString(), lng: dragLng.toString() }))

      const geocoder = new (window as any).google.maps.Geocoder()
      geocoder.geocode({ location: { lat: dragLat, lng: dragLng } }, (results: any, status: string) => {
        if (status === "OK" && results[0]) {
          const addr = results[0].formatted_address
          setFormData(prev => ({ ...prev, address: addr }))
          if (addressInputRef.current) addressInputRef.current.value = addr

          let city = ""
          let state = ""
          for (const comp of results[0].address_components) {
            if (comp.types.includes("locality")) city = comp.long_name
            else if (comp.types.includes("administrative_area_level_1")) state = comp.long_name
            else if (!city && comp.types.includes("administrative_area_level_2")) city = comp.long_name
          }
          if (city) setFormData(prev => ({ ...prev, city }))
          if (state) setFormData(prev => ({ ...prev, state }))
        }
      })
    })

    // Autocomplete logic
    if (addressInputRef.current) {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInputRef.current, {
        fields: ["geometry", "formatted_address", "address_components", "name"],
      })
      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place.geometry?.location) return

        const newLat = place.geometry.location.lat()
        const newLng = place.geometry.location.lng()
        const addr = place.formatted_address || place.name || ""

        let city = ""
        let state = ""
        if (place.address_components) {
          for (const comp of place.address_components) {
            if (comp.types.includes("locality")) city = comp.long_name
            else if (comp.types.includes("administrative_area_level_1")) state = comp.long_name
            else if (!city && comp.types.includes("administrative_area_level_2")) city = comp.long_name
          }
        }

        setFormData(prev => ({
          ...prev,
          address: addr,
          lat: newLat.toString(),
          lng: newLng.toString(),
          city: city || prev.city,
          state: state || prev.state,
        }))

        map.setCenter({ lat: newLat, lng: newLng })
        map.setZoom(16)
        marker.setPosition({ lat: newLat, lng: newLng })
      })
    }
  }, [formData.lat, formData.lng])

  useEffect(() => {
    const apiKey = process.env.MAP_KEY
    if (!apiKey) {
      setMapError("Google Maps API key not configured.")
      return
    }

    if ((window as any).google?.maps) {
      initMap()
      return
    }

    if ((window as any)._googleMapsLoading) {
      (window as any).initGoogleMaps = initMap
      return
    }

    (window as any)._googleMapsLoading = true;
    (window as any).initGoogleMaps = () => {
      (window as any)._googleMapsLoading = false
      initMap()
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
    script.async = true
    script.defer = true
    script.onerror = () => setMapError("Failed to load Google Maps.")
    document.head.appendChild(script)

    return () => {
      // keep instance
    }
  }, [initMap])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLatLonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    const val = parseFloat(value)
    if (!isNaN(val) && mapInstanceRef.current && markerInstanceRef.current) {
      const currentLat = name === "lat" ? val : parseFloat(formData.lat)
      const currentLng = name === "lng" ? val : parseFloat(formData.lng)
      if (!isNaN(currentLat) && !isNaN(currentLng)) {
        const center = { lat: currentLat, lng: currentLng }
        mapInstanceRef.current.setCenter(center)
        markerInstanceRef.current.setPosition(center)
      }
    }
  }

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...newImages])
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (logo) URL.revokeObjectURL(logo.preview)
      setLogo({ file, preview: URL.createObjectURL(file) })
    }
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (banner) URL.revokeObjectURL(banner.preview)
      setBanner({ file, preview: URL.createObjectURL(file) })
    }
    if (bannerInputRef.current) bannerInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.name || !formData.city || !formData.address) {
      setError("Please fill in all required fields (Name, City, Address)")
      setLoading(false)
      return
    }

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => data.append(key, value))
      data.append("amenities", JSON.stringify(selectedAmenities))

      images.forEach((img) => data.append("images", img.file))
      if (logo) data.append("logo", logo.file)
      if (banner) data.append("banner", banner.file)

      const res = await fetch("/api/hotel-seller/hotels", {
        method: "POST",
        body: data,
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to create hotel")
      }

      router.push("/hotel-seller/hotels")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-muted/80">
          <Link href="/hotel-seller/hotels">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Add New Hotel
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Register your property on the platform</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">General Information</CardTitle>
                <CardDescription>Property name, description and star rating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold ml-1">Hotel Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter hotel name"
                    className="rounded-2xl h-12 bg-background border-muted focus:ring-primary/20"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-bold ml-1">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Tell guests about your property..."
                    className="rounded-2xl min-h-[120px] bg-background border-muted resize-none"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Star Rating</Label>
                    <Select
                      value={formData.starRating}
                      onValueChange={(val) => setFormData(p => ({ ...p, starRating: val }))}
                    >
                      <SelectTrigger className="rounded-2xl h-12">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <SelectItem key={r} value={r.toString()} className="rounded-xl">
                            <div className="flex items-center gap-2">
                              {r} Stars <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Check-in After</Label>
                    <Input
                      type="time"
                      name="checkInPolicy"
                      className="rounded-2xl h-12"
                      value={formData.checkInPolicy}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Check-out Before</Label>
                    <Input
                      type="time"
                      name="checkOutPolicy"
                      className="rounded-2xl h-12"
                      value={formData.checkOutPolicy}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Location Details</CardTitle>
                <CardDescription>Where guests can find your hotel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-bold ml-1">Full Address <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      name="address"
                      ref={addressInputRef}
                      placeholder="Street name, landmark..."
                      className="rounded-2xl h-12 pl-11"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">City <span className="text-destructive">*</span></Label>
                    <Input
                      name="city"
                      placeholder="City"
                      className="rounded-2xl h-12"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">State</Label>
                    <Input
                      name="state"
                      placeholder="State"
                      className="rounded-2xl h-12"
                      value={formData.state}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                {/* Map Display */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold ml-1">Locate on Map (Drag marker or click map to adjust location)</Label>
                  {mapError ? (
                    <div className="h-56 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center text-xs font-bold">
                      {mapError}
                    </div>
                  ) : (
                    <div ref={mapContainerRef} className="h-60 w-full rounded-2xl border border-muted overflow-hidden bg-muted/10 shadow-inner" style={{ minHeight: 240 }} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Latitude (Optional)</Label>
                    <Input
                      name="lat"
                      type="number"
                      step="any"
                      placeholder="0.0000"
                      className="rounded-2xl h-12"
                      value={formData.lat}
                      onChange={handleLatLonChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Longitude (Optional)</Label>
                    <Input
                      name="lng"
                      type="number"
                      step="any"
                      placeholder="0.0000"
                      className="rounded-2xl h-12"
                      value={formData.lng}
                      onChange={handleLatLonChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Property Amenities</CardTitle>
                <CardDescription>Select all features available at your hotel</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {HOTEL_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity.id)
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 h-24",
                          isSelected
                            ? "bg-primary/10 border-primary shadow-lg shadow-primary/5 text-primary scale-105"
                            : "bg-background border-muted text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        <div className={cn("p-2 rounded-full", isSelected ? "bg-primary text-white" : "bg-muted")}>
                          {amenity.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{amenity.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Images */}
          <div className="space-y-8">
            {/* Gallery */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Gallery</CardTitle>
                <CardDescription>Upload property photos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="group cursor-pointer border-2 border-dashed border-muted rounded-[2rem] p-8 text-center hover:border-primary/50 transition-all bg-muted/20 hover:bg-muted/30"
                >
                  <div className="bg-background rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Photos</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, JPEG, PNG, WebP allowed</p>
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden shadow-md">
                      <img src={img.preview} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Logo & Banner */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pb-8">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest ml-1 text-muted-foreground">Hotel Logo</Label>
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="relative group cursor-pointer border-2 border-dashed border-muted rounded-2xl p-4 text-center hover:border-primary/50 bg-muted/10 h-28 flex flex-col items-center justify-center overflow-hidden"
                  >
                    {logo ? (
                      <>
                        <img src={logo.preview} className="absolute inset-0 w-full h-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Upload Logo</span>
                      </div>
                    )}
                    <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest ml-1 text-muted-foreground">Main Banner</Label>
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className="relative group cursor-pointer border-2 border-dashed border-muted rounded-2xl p-4 text-center hover:border-primary/50 bg-muted/10 h-32 flex flex-col items-center justify-center overflow-hidden"
                  >
                    {banner ? (
                      <>
                        <img src={banner.preview} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Upload Banner</span>
                      </div>
                    )}
                    <input type="file" ref={bannerInputRef} onChange={handleBannerChange} accept="image/*" className="hidden" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold flex items-center gap-3">
            <X className="h-5 w-5 p-1 bg-destructive text-white rounded-full" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-4 pb-12">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl px-8 h-14 font-bold border-muted"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-2xl px-12 h-14 font-black text-lg shadow-2xl shadow-primary/30"
            disabled={loading}
          >
            {loading ? "Creating..." : "Save Property"}
          </Button>
        </div>
      </form>
    </div>
  )
}
