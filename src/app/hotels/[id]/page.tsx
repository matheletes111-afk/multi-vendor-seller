"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Star, MapPin, Building2, CheckCircle2, ChevronRight, User, Users, Coffee, ShieldAlert, ArrowLeft } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"

type Room = {
  id: string
  name: string
  description: string | null
  price: number
  capacityAdults: number
  capacityChildren: number
  amenities: any
  images: any
  totalRooms: number
}

type Hotel = {
  id: string
  name: string
  description: string | null
  starRating: number
  address: string | null
  city: string | null
  state: string | null
  checkInPolicy: string | null
  checkOutPolicy: string | null
  amenities: any
  images: any
  rooms: Room[]
}

export default function HotelDetailsPage() {
  const { id } = useParams()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHotelDetails = async () => {
      try {
        const res = await fetch(`/api/hotels/${id}`)
        const data = await res.json()
        if (data.success) {
          setHotel(data.data)
        }
      } catch (error) {
        console.error("Failed to load hotel details:", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchHotelDetails()
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-7xl">
        <Building2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-semibold text-sm">Loading property details...</p>
      </div>
    )
  }

  if (!hotel) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-7xl">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Hotel Not Found</h3>
        <p className="text-slate-500 text-sm mt-1">The hotel property could not be found or has been disabled.</p>
        <Link href="/hotels" className="inline-block mt-6">
          <Button className="bg-slate-900 text-white rounded-xl">Back to Stays</Button>
        </Link>
      </div>
    )
  }

  const images = Array.isArray(hotel.images) ? hotel.images : []
  const mainImage = images[0] || "/images/placeholder-hotel.jpg"
  const amenitiesList = Array.isArray(hotel.amenities) ? hotel.amenities : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8 animate-in fade-in duration-500">
      {/* Back navigation */}
      <Link href="/hotels" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Stays
      </Link>

      {/* Hotel Title & Header Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Hotel info and gallery */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-[16/9] rounded-[2rem] overflow-hidden bg-slate-100 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mainImage} alt={hotel.name} className="object-cover h-full w-full" />
            <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{hotel.name}</h1>
                <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{hotel.address}, {hotel.city}, {hotel.state}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm self-start sm:self-auto shrink-0">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                <span>{hotel.starRating} Star Stay</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-slate-900">About the Property</h2>
            <p className="text-slate-600 font-medium leading-relaxed">{hotel.description}</p>

            {/* Amenities Grid */}
            {amenitiesList.length > 0 && (
              <div className="pt-6 border-t border-slate-50 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Features & Amenities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {amenitiesList.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hotel Policies Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
            <h3 className="text-lg font-black text-slate-900 pb-3 border-b border-slate-50">Hotel Policies</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Check-in Policy</span>
                <p className="text-slate-600 text-sm font-medium leading-relaxed">{hotel.checkInPolicy || "Check-in time starts at 14:00 PM. Identification card required."}</p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Check-out Policy</span>
                <p className="text-slate-600 text-sm font-medium leading-relaxed">{hotel.checkOutPolicy || "Check-out time is until 11:00 AM. Late check-out subject to availability."}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Luxury Rooms & Suites Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Luxury Rooms & Suites</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Compare pricing, occupancies, and select your suite below.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hotel.rooms.map((room) => {
            const roomImages = Array.isArray(room.images) ? room.images : []
            const roomImage = roomImages[0] || "/images/placeholder-room.jpg"
            const roomAmenities = Array.isArray(room.amenities) ? room.amenities : []

            return (
              <Card key={room.id} className="rounded-[2rem] overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full bg-white group">
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={roomImage} alt={room.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500" />
                </div>

                <CardContent className="p-6 flex flex-col flex-1 justify-between">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{room.name}</h3>
                      <p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed">{room.description}</p>
                    </div>

                    {/* Capacities */}
                    <div className="flex items-center gap-4 text-slate-500 text-xs font-semibold py-2 border-y border-slate-50">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{room.capacityAdults} Adults</span>
                      </div>
                      {room.capacityChildren > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{room.capacityChildren} Children</span>
                        </div>
                      )}
                    </div>

                    {/* Room Amenities */}
                    {roomAmenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-12 overflow-hidden">
                        {roomAmenities.slice(0, 3).map((amenity, index) => (
                          <span key={index} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                            <Coffee className="h-3 w-3 text-emerald-600 shrink-0" /> {amenity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per Night</p>
                      <p className="text-xl font-black text-emerald-600">{formatCurrency(room.price)}</p>
                    </div>

                    <Link href={`/hotels/rooms/${room.id}`}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest h-11 px-5 shadow-md shadow-emerald-500/10 flex items-center gap-1">
                        Book Room <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
