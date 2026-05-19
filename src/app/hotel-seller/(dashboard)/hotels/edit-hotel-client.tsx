"use client"

import { useState, useRef } from "react"
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
}

export function EditHotelClient({ hotel }: { hotel: Hotel }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) => 
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imagesWithPreviews = files.map((file) => ({
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (logo.file) URL.revokeObjectURL(logo.preview!)
      setLogo({ file, preview: URL.createObjectURL(file) })
    }
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (banner.file) URL.revokeObjectURL(banner.preview!)
      setBanner({ file, preview: URL.createObjectURL(file) })
    }
    if (bannerInputRef.current) bannerInputRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => data.append(key, value))
      data.append("amenities", JSON.stringify(selectedAmenities))
      data.append("existingImages", JSON.stringify(existingImages))
      
      newImages.forEach((img) => data.append("newImages", img.file))
      if (logo.file) data.append("logo", logo.file)
      if (banner.file) data.append("banner", banner.file)

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
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <Label className="text-sm font-bold ml-1">Full Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                    <Input name="address" className="rounded-2xl h-12 pl-11" value={formData.address} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">City</Label>
                    <Input name="city" className="rounded-2xl h-12" value={formData.city} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">State</Label>
                    <Input name="state" className="rounded-2xl h-12" value={formData.state} onChange={handleInputChange} />
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
