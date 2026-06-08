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
  Dumbbell,
  Plus,
  Trash2
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

interface Hotel {
  id: string
  name: string
  description: string | null
  starRating: number
  amenities: any
  checkInPolicy: string | null
  checkOutPolicy: string | null
  address: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  images: any
  logo: string | null
  banner: string | null
  rooms?: any[]
}

export function EditHotelClient({ hotel }: { hotel: Hotel }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  interface RoomDraft {
    id?: string
    name: string
    description: string
    price: string
    capacityAdults: string
    capacityChildren: string
    totalRooms: string
    amenities: string[]
    existingImages?: string[]
    newImages: { file: File; preview: string }[]
    isDeleted?: boolean
  }

  const [rooms, setRooms] = useState<RoomDraft[]>(
    Array.isArray(hotel.rooms)
      ? hotel.rooms.map((r) => ({
          id: r.id,
          name: r.name || "",
          description: r.description || "",
          price: r.price?.toString() || "",
          capacityAdults: r.capacityAdults?.toString() || "2",
          capacityChildren: r.capacityChildren?.toString() || "0",
          totalRooms: r.totalRooms?.toString() || "1",
          amenities: Array.isArray(r.amenities) ? r.amenities : [],
          existingImages: Array.isArray(r.images) ? r.images : [],
          newImages: [],
          isDeleted: false
        }))
      : []
  )

  const addRoom = () => {
    setRooms(prev => [
      ...prev,
      {
        name: "",
        description: "",
        price: "",
        capacityAdults: "2",
        capacityChildren: "0",
        totalRooms: "1",
        amenities: [],
        newImages: []
      }
    ])
  }

  const removeRoom = (index: number) => {
    setRooms(prev => {
      const updated = [...prev]
      const room = updated[index]
      if (room.id) {
        room.isDeleted = true
      } else {
        updated.splice(index, 1)
      }
      return updated
    })
  }

  const updateRoomField = (index: number, field: keyof RoomDraft, value: any) => {
    setRooms(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const toggleRoomAmenity = (roomIndex: number, amenityId: string) => {
    setRooms(prev => {
      const updated = [...prev]
      const targetRoom = { ...updated[roomIndex] }
      let currentAmenities = targetRoom.amenities
      if (typeof currentAmenities === "string") {
        try {
          currentAmenities = JSON.parse(currentAmenities)
        } catch {
          currentAmenities = []
        }
      }
      if (!Array.isArray(currentAmenities)) {
        currentAmenities = []
      }
      if (currentAmenities.includes(amenityId)) {
        targetRoom.amenities = currentAmenities.filter(id => id !== amenityId)
      } else {
        targetRoom.amenities = [...currentAmenities, amenityId]
      }
      updated[roomIndex] = targetRoom
      return updated
    })
  }

  const handleRoomImageChange = async (roomIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    let compressedFiles = files;
    try {
      const { compressImage } = await import("@/lib/image-compressor");
      compressedFiles = await Promise.all(
        files.map(async (file) => {
          if (file.type.startsWith("image/")) {
            return await compressImage(file).catch(() => file);
          }
          return file;
        })
      );
    } catch (err) {
      console.error("Compression error:", err);
    }

    const imagesWithPreviews = compressedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setRooms(prev => {
      const updated = [...prev]
      const targetRoom = { ...updated[roomIndex] }
      targetRoom.newImages = [...(targetRoom.newImages || []), ...imagesWithPreviews]
      updated[roomIndex] = targetRoom
      return updated
    })
    e.target.value = ""
  }

  const removeRoomNewImage = (roomIndex: number, imageIndex: number) => {
    setRooms(prev => {
      const updated = [...prev]
      const targetRoom = { ...updated[roomIndex] }
      const targetImages = [...(targetRoom.newImages || [])]
      const img = targetImages[imageIndex]
      if (img?.preview) {
        URL.revokeObjectURL(img.preview)
      }
      targetImages.splice(imageIndex, 1)
      targetRoom.newImages = targetImages
      updated[roomIndex] = targetRoom
      return updated
    })
  }

  const removeRoomExistingImage = (roomIndex: number, imageUrl: string) => {
    setRooms(prev => {
      const updated = [...prev]
      updated[roomIndex].existingImages = updated[roomIndex].existingImages?.filter(url => url !== imageUrl)
      return updated
    })
  }

  // Form State
  const [formData, setFormData] = useState({
    name: hotel.name || "",
    description: hotel.description || "",
    starRating: hotel.starRating.toString() || "3",
    checkInPolicy: hotel.checkInPolicy || "14:00",
    checkOutPolicy: hotel.checkOutPolicy || "11:00",
    address: hotel.address || "",
    city: hotel.city || "",
    state: hotel.state || "",
    lat: hotel.lat?.toString() || "",
    lng: hotel.lng?.toString() || "",
  })

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    Array.isArray(hotel.amenities) ? hotel.amenities : 
    (typeof hotel.amenities === 'string' ? JSON.parse(hotel.amenities) : [])
  )
  
  // Image State
  const [existingImages, setExistingImages] = useState<string[]>(
    Array.isArray(hotel.images) ? hotel.images : 
    (typeof hotel.images === 'string' ? JSON.parse(hotel.images) : [])
  )
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([])
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({
    file: null,
    preview: hotel.logo
  })
  const [banner, setBanner] = useState<{ file: File | null; preview: string | null }>({
    file: null,
    preview: hotel.banner
  })

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
    let active = true
    fetch("/api/utils/maps-key")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized or not configured")
        return res.json()
      })
      .then((data) => {
        if (!active) return
        const apiKey = data.key
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
      })
      .catch((err) => {
        if (active) {
          setMapError(err.message || "Failed to configure map API key.")
        }
      })

    return () => {
      active = false
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

  const handleNewImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    let compressedFiles = files;
    try {
      const { compressImage } = await import("@/lib/image-compressor");
      compressedFiles = await Promise.all(
        files.map(async (file) => {
          if (file.type.startsWith("image/")) {
            return await compressImage(file).catch(() => file);
          }
          return file;
        })
      );
    } catch (err) {
      console.error("Compression error:", err);
    }

    const imagesWithPreviews = compressedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setNewImages((prev) => [...prev, ...imagesWithPreviews])
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeNewImage = (index: number) => {
    setNewImages((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (rawFile) {
      let file: File = rawFile
      if (rawFile.type.startsWith("image/")) {
        try {
          const { compressImage } = await import("@/lib/image-compressor");
          file = await compressImage(rawFile).catch(() => rawFile);
        } catch (err) {
          console.error("Compression error:", err);
        }
      }
      if (logo.file) URL.revokeObjectURL(logo.preview!)
      setLogo({ file, preview: URL.createObjectURL(file) })
    }
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (rawFile) {
      let file: File = rawFile
      if (rawFile.type.startsWith("image/")) {
        try {
          const { compressImage } = await import("@/lib/image-compressor");
          file = await compressImage(rawFile).catch(() => rawFile);
        } catch (err) {
          console.error("Compression error:", err);
        }
      }
      if (banner.file) URL.revokeObjectURL(banner.preview!)
      setBanner({ file, preview: URL.createObjectURL(file) })
    }
    if (bannerInputRef.current) bannerInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate non-deleted rooms
    for (let i = 0; i < rooms.length; i++) {
      if (!rooms[i].isDeleted && (!rooms[i].name || !rooms[i].price)) {
        setError(`Please fill in Name and Price for Room Type #${i + 1}`);
        setLoading(false);
        return;
      }
    }

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => data.append(key, value))
      data.append("amenities", JSON.stringify(selectedAmenities))
      data.append("existingImages", JSON.stringify(existingImages))
      
      newImages.forEach((img) => data.append("newImages", img.file))
      if (logo.file) data.append("logo", logo.file)
      if (banner.file) data.append("banner", banner.file)

      // Append rooms metadata
      const roomsMetadata = rooms.map((r, idx) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price,
        capacityAdults: r.capacityAdults,
        capacityChildren: r.capacityChildren,
        totalRooms: r.totalRooms,
        amenities: r.amenities,
        existingImages: r.existingImages,
        isDeleted: r.isDeleted,
        index: idx // for identifying new room image mappings
      }))
      data.append("rooms", JSON.stringify(roomsMetadata))

      // Append new room images
      rooms.forEach((r, idx) => {
        if (r.isDeleted) return
        if (r.id) {
          // Existing room additions
          r.newImages.forEach((img) => {
            data.append(`room_${r.id}_newImages`, img.file)
          })
        } else {
          // New draft room additions
          r.newImages.forEach((img) => {
            data.append(`room_new_${idx}_images`, img.file)
          })
        }
      })

      const res = await fetch(`/api/hotel-seller/hotels/${hotel.id}`, {
        method: "PATCH",
        body: data,
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to update hotel")
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
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/hotel-seller/hotels">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Edit Hotel
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Update your property details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">General Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold ml-1">Hotel Name</Label>
                  <Input
                    id="name"
                    name="name"
                    className="rounded-2xl h-12"
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
                    className="rounded-2xl min-h-[120px]"
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
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <SelectItem key={r} value={r.toString()}>
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
                    <Input type="time" name="checkInPolicy" className="rounded-2xl h-12" value={formData.checkInPolicy} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Check-out Before</Label>
                    <Input type="time" name="checkOutPolicy" className="rounded-2xl h-12" value={formData.checkOutPolicy} onChange={handleInputChange} />
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
                          isSelected ? "bg-primary/10 border-primary text-primary scale-105 shadow-lg shadow-primary/5" : "bg-background border-muted text-muted-foreground"
                        )}
                      >
                        <div className={cn("p-2 rounded-full", isSelected ? "bg-primary text-white" : "bg-muted")}>{amenity.icon}</div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{amenity.label}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Gallery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                <div 
                  onClick={() => imageInputRef.current?.click()}
                  className="group cursor-pointer border-2 border-dashed border-muted rounded-[2rem] p-8 text-center hover:border-primary/50 bg-muted/20"
                >
                  <Camera className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase">Add Photos</p>
                  <input type="file" ref={imageInputRef} onChange={handleNewImageChange} multiple accept="image/*" className="hidden" />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {existingImages.map((url, idx) => (
                    <div key={`exp-${idx}`} className="relative group aspect-square rounded-2xl overflow-hidden shadow-md">
                      <img src={url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeExistingImage(idx)} className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {newImages.map((img, idx) => (
                    <div key={`new-${idx}`} className="relative group aspect-square rounded-2xl overflow-hidden shadow-md border-2 border-primary/20">
                      <img src={img.preview} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter">New</div>
                      <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 px-8 pb-8">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase ml-1">Hotel Logo</Label>
                  <div onClick={() => logoInputRef.current?.click()} className="relative group cursor-pointer border-2 border-dashed border-muted rounded-2xl p-4 h-28 flex flex-col items-center justify-center overflow-hidden bg-muted/10">
                    {logo.preview ? (
                      <img src={logo.preview} className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                    <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase ml-1">Main Banner</Label>
                  <div onClick={() => bannerInputRef.current?.click()} className="relative group cursor-pointer border-2 border-dashed border-muted rounded-2xl p-4 h-32 flex flex-col items-center justify-center overflow-hidden bg-muted/10">
                    {banner.preview ? (
                      <img src={banner.preview} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                    <input type="file" ref={bannerInputRef} onChange={handleBannerChange} accept="image/*" className="hidden" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Room Types Card */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="pb-2 pt-8 px-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Room Configurations</CardTitle>
              <CardDescription>Manage the types of rooms available in this hotel</CardDescription>
            </div>
            <Button type="button" onClick={addRoom} size="sm" className="rounded-xl flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add Room Type
            </Button>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {rooms.map((room, originalIndex) => {
              if (room.isDeleted) return null
              const visibleIndex = rooms.filter((r, idx) => !r.isDeleted && idx < originalIndex).length + 1

              return (
                <div key={room.id || `new-room-${originalIndex}`} className="p-6 rounded-3xl border border-muted bg-background/50 relative space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="font-bold text-slate-800">Room Type #{visibleIndex}</h4>
                    {rooms.filter(r => !r.isDeleted).length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => removeRoom(originalIndex)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Room Name *</Label>
                      <Input
                        placeholder="e.g. Deluxe Suite"
                        value={room.name}
                        onChange={(e) => updateRoomField(originalIndex, "name", e.target.value)}
                        className="rounded-2xl h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Price per Night *</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={room.price}
                        onChange={(e) => updateRoomField(originalIndex, "price", e.target.value)}
                        className="rounded-2xl h-12"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Adult Capacity</Label>
                      <Input
                        type="number"
                        value={room.capacityAdults}
                        onChange={(e) => updateRoomField(originalIndex, "capacityAdults", e.target.value)}
                        className="rounded-2xl h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Child Capacity</Label>
                      <Input
                        type="number"
                        value={room.capacityChildren}
                        onChange={(e) => updateRoomField(originalIndex, "capacityChildren", e.target.value)}
                        className="rounded-2xl h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Total Rooms</Label>
                      <Input
                        type="number"
                        value={room.totalRooms}
                        onChange={(e) => updateRoomField(originalIndex, "totalRooms", e.target.value)}
                        className="rounded-2xl h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Description</Label>
                    <Textarea
                      placeholder="Room amenities, bed sizes, view..."
                      value={room.description}
                      onChange={(e) => updateRoomField(originalIndex, "description", e.target.value)}
                      className="rounded-2xl min-h-[80px]"
                    />
                  </div>

                  {/* Room Amenities */}
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Room Amenities</Label>
                    <div className="flex flex-wrap gap-2">
                      {HOTEL_AMENITIES.map((amenity) => {
                        let roomAmenitiesList = room.amenities
                        if (typeof roomAmenitiesList === "string") {
                          try {
                            roomAmenitiesList = JSON.parse(roomAmenitiesList)
                          } catch {
                            roomAmenitiesList = []
                          }
                        }
                        const isSelected = Array.isArray(roomAmenitiesList) ? roomAmenitiesList.includes(amenity.id) : false
                        return (
                          <button
                            key={amenity.id}
                            type="button"
                            onClick={() => toggleRoomAmenity(originalIndex, amenity.id)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                              isSelected
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-muted text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {amenity.icon}
                            <span>{amenity.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Room Images */}
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Room Photos</Label>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
                      {room.existingImages?.map((url, imgIdx) => (
                        <div key={`existing-${imgIdx}`} className="relative aspect-square rounded-2xl overflow-hidden shadow border group">
                          <img src={url} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeRoomExistingImage(originalIndex, url)}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {room.newImages.map((img, imgIdx) => (
                        <div key={`new-${imgIdx}`} className="relative aspect-square rounded-2xl overflow-hidden shadow border group border-primary/20">
                          <img src={img.preview} className="w-full h-full object-cover" />
                          <div className="absolute top-1 left-1 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded-full uppercase">New</div>
                          <button
                            type="button"
                            onClick={() => removeRoomNewImage(originalIndex, imgIdx)}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div
                      onClick={() => {
                        const input = document.getElementById(`room-img-input-${originalIndex}`)
                        if (input) (input as HTMLInputElement).click()
                      }}
                      className="cursor-pointer border-2 border-dashed border-muted rounded-2xl p-4 text-center hover:border-primary/50 bg-muted/15 flex items-center justify-center gap-2 h-14"
                    >
                      <Camera className="h-5 w-5 text-primary" />
                      <span className="text-xs font-bold uppercase text-muted-foreground">Upload Room Photos</span>
                    </div>
                    <input
                      id={`room-img-input-${originalIndex}`}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleRoomImageChange(originalIndex, e)}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {error && <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl font-bold flex items-center gap-3"><X className="h-5 w-5 bg-destructive text-white rounded-full" /> {error}</div>}

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" className="rounded-2xl px-8 h-14 font-bold" onClick={() => router.back()} disabled={loading}>Cancel</Button>
          <Button type="submit" className="rounded-2xl px-12 h-14 font-black text-lg shadow-2xl shadow-primary/30" disabled={loading}>
            {loading ? "Updating..." : "Update Property"}
          </Button>
        </div>
      </form>
    </div>
  )
}
