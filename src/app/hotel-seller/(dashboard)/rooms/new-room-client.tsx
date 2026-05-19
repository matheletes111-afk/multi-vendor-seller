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
  Bed, 
  X, 
  Camera, 
  ArrowLeft, 
  Hotel, 
  Users, 
  DollarSign, 
  Layers,
  Tv,
  Wind,
  Square,
  Coffee,
  Bath,
  Briefcase,
  Lock,
  Sunrise
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const ROOM_AMENITIES = [
  { id: "tv", label: "Smart TV", icon: <Tv className="h-4 w-4" /> },
  { id: "ac", label: "Air Conditioning", icon: <Wind className="h-4 w-4" /> },
  { id: "balcony", label: "Balcony", icon: <Square className="h-4 w-4" /> },
  { id: "view", label: "City View", icon: <Sunrise className="h-4 w-4" /> },
  { id: "minibar", label: "Minibar", icon: <Coffee className="h-4 w-4" /> },
  { id: "bathtub", label: "Bathtub", icon: <Bath className="h-4 w-4" /> },
  { id: "desk", label: "Work Desk", icon: <Briefcase className="h-4 w-4" /> },
  { id: "safe", label: "Safe Box", icon: <Lock className="h-4 w-4" /> },
]

export function NewRoomClient({ hotels }: { hotels: { id: string, name: string }[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    hotelId: hotels[0]?.id || "",
    name: "",
    description: "",
    price: "",
    capacityAdults: "2",
    capacityChildren: "0",
    totalRooms: "1",
  })

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.hotelId || !formData.name || !formData.price) {
      setError("Please fill in required fields (Hotel, Name, Price)")
      setLoading(false)
      return
    }

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => data.append(key, value))
      data.append("amenities", JSON.stringify(selectedAmenities))
      images.forEach((img) => data.append("images", img.file))

      const res = await fetch("/api/hotel-seller/rooms", {
        method: "POST",
        body: data,
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to create room type")
      }

      router.push("/hotel-seller/rooms")
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
          <Link href="/hotel-seller/rooms">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Bed className="h-8 w-8 text-primary" />
            Add Room Type
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Define a new room category for your property</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Room Details</CardTitle>
                <CardDescription>Basic information about this room type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="space-y-2">
                  <Label className="text-sm font-bold ml-1">Assigned Hotel <span className="text-destructive">*</span></Label>
                  <Select 
                    value={formData.hotelId} 
                    onValueChange={(val) => setFormData(p => ({ ...p, hotelId: val }))}
                  >
                    <SelectTrigger className="rounded-2xl h-12">
                      <div className="flex items-center gap-2">
                        <Hotel className="h-4 w-4 text-primary" />
                        <SelectValue placeholder="Select a hotel" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {hotels.map((h) => (
                        <SelectItem key={h.id} value={h.id} className="rounded-xl">{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold ml-1">Room Type Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Deluxe Ocean View, Presidential Suite"
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
                    placeholder="Describe the room features, view, and unique selling points..."
                    className="rounded-2xl min-h-[120px] resize-none"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Pricing & Capacity</CardTitle>
                <CardDescription>Define rates and occupant limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Price Per Night <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-3.5 h-4 w-4 text-primary" />
                      <Input
                        type="number"
                        name="price"
                        placeholder="0.00"
                        className="rounded-2xl h-12 pl-11 font-bold text-lg"
                        value={formData.price}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Total Rooms Available</Label>
                    <div className="relative">
                      <Layers className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        name="totalRooms"
                        className="rounded-2xl h-12 pl-11"
                        value={formData.totalRooms}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Adult Capacity</Label>
                    <div className="relative">
                      <Users className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        name="capacityAdults"
                        className="rounded-2xl h-12 pl-11"
                        value={formData.capacityAdults}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold ml-1">Child Capacity</Label>
                    <div className="relative">
                      <Users className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        name="capacityChildren"
                        className="rounded-2xl h-12 pl-11"
                        value={formData.capacityChildren}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-xl font-bold">Room Amenities</CardTitle>
                <CardDescription>Features available inside the room</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ROOM_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity.id)
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 h-24",
                          isSelected ? "bg-primary/10 border-primary text-primary scale-105 shadow-lg shadow-primary/5" : "bg-background border-muted text-muted-foreground hover:border-primary/40"
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
                <CardTitle className="text-xl font-bold">Room Photos</CardTitle>
                <CardDescription>Upload high-quality images of the room</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                <div 
                  onClick={() => imageInputRef.current?.click()}
                  className="group cursor-pointer border-2 border-dashed border-muted rounded-[2rem] p-8 text-center hover:border-primary/50 transition-all bg-muted/20 hover:bg-muted/30"
                >
                  <Camera className="h-6 w-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-bold uppercase tracking-wider">Select Photos</p>
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
                        className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
              <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Inventory Tip
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define the total number of rooms of this type you have in your property. You can block specific dates later in the availability calendar.
              </p>
            </div>
          </div>
        </div>

        {error && <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl font-bold flex items-center gap-3"><X className="h-5 w-5 bg-destructive text-white rounded-full" /> {error}</div>}

        <div className="flex justify-end gap-4 pb-12">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl px-8 h-14 font-bold"
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
            {loading ? "Creating..." : "Save Room Type"}
          </Button>
        </div>
      </form>
    </div>
  )
}
