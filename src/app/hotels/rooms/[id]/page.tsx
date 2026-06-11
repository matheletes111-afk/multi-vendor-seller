"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Star, MapPin, CheckCircle2, User, Users, Coffee, Bed, ArrowLeft, Loader2, Calendar, Lock, AlertCircle, Building2 } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"

type Hotel = {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  starRating: number
}

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
  hotel: Hotel
}

export default function RoomBookingPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)

  // Booking fields
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [numberOfRooms, setNumberOfRooms] = useState(1)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)

  // Feedback states
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState<any>(null)

  const isLoggedIn = status === "authenticated" && !!session?.user

  useEffect(() => {
    const fetchRoomDetails = async () => {
      try {
        const res = await fetch(`/api/hotels/rooms/${id}`)
        const data = await res.json()
        if (data.success) {
          setRoom(data.data)
        }
      } catch (error) {
        console.error("Failed to load room details:", error)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchRoomDetails()
  }, [id])

  // Pre-fill user name if logged in
  useEffect(() => {
    if (isLoggedIn && session?.user?.name) {
      setGuestName(session.user.name)
    }
  }, [isLoggedIn, session])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-7xl">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-semibold text-sm">Loading suite configurations...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-7xl">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Room Configuration Not Found</h3>
        <p className="text-slate-500 text-sm mt-1">This room package is no longer available.</p>
        <Link href="/hotels" className="inline-block mt-6">
          <Button className="bg-slate-900 text-white rounded-xl">Back to Stays</Button>
        </Link>
      </div>
    )
  }

  const roomImages = Array.isArray(room.images) ? room.images : []
  const mainImage = roomImages[0] || "/images/placeholder-room.jpg"
  const roomAmenities = Array.isArray(room.amenities) ? room.amenities : []

  // Dynamic price calculations
  let totalNights = 0
  let calculatedTotalPrice = 0

  if (checkIn && checkOut) {
    const d1 = new Date(checkIn)
    const d2 = new Date(checkOut)
    d1.setHours(0,0,0,0)
    d2.setHours(0,0,0,0)
    const diffTime = d2.getTime() - d1.getTime()
    if (diffTime > 0) {
      totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      calculatedTotalPrice = totalNights * room.price * numberOfRooms
    }
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return

    setBookingLoading(true)
    setBookingError(null)

    try {
      const res = await fetch(`/api/hotels/rooms/${room.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          numberOfRooms,
          guestName,
          guestPhone,
          adults,
          children
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Room booking failed.")
      }

      setBookingSuccess(data.data)
    } catch (err: any) {
      setBookingError(err.message || "An unexpected error occurred during your booking.")
    } finally {
      setBookingLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8 animate-in fade-in duration-500">
      {/* Back link */}
      <Link href={`/hotels/${room.hotel.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Hotel Stays
      </Link>

      {bookingSuccess ? (
        /* Success screen wrapper */
        <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 sm:p-12 text-center shadow-lg space-y-6">
          <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Booking Confirmed!</h2>
            <p className="text-slate-500 font-medium">Your stay at <span className="font-bold text-slate-700">{room.hotel.name}</span> has been confirmed.</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left space-y-4 text-sm font-medium text-slate-600">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span>Booking reference ID:</span>
              <span className="font-bold text-slate-900 truncate max-w-xs">{bookingSuccess.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <span>Suite / Category:</span>
              <span className="font-bold text-slate-900">{room.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Check-in</span>
                <span className="font-bold text-slate-900 text-base mt-0.5 block">{new Date(bookingSuccess.checkIn).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Check-out</span>
                <span className="font-bold text-slate-900 text-base mt-0.5 block">{new Date(bookingSuccess.checkOut).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Total Price Paid:</span>
              <span className="font-black text-emerald-600 text-lg">{formatCurrency(bookingSuccess.totalPrice)}</span>
            </div>
          </div>

          <div className="pt-4 flex gap-4 justify-center">
            <Link href="/hotels">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold h-11 px-6">Explore Other Stays</Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Booking flow split page */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room photos, description, and details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gallery placeholder images */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4 relative aspect-[16/9] rounded-[2rem] overflow-hidden bg-slate-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainImage} alt={room.name} className="object-cover h-full w-full" />
              </div>
              {roomImages.slice(1, 5).map((imgUrl, index) => (
                <div key={index} className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt={`${room.name} gallery ${index + 1}`} className="object-cover h-full w-full" />
                </div>
              ))}
            </div>

            {/* Room description */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{room.name}</h1>
                <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{room.hotel.name} — {room.hotel.address}, {room.hotel.city}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 py-4 border-y border-slate-50 text-slate-600 text-sm font-semibold">
                <div className="flex items-center gap-1.5">
                  <Bed className="h-4.5 w-4.5 text-emerald-600" />
                  <span>{room.capacityAdults} Adults</span>
                </div>
                {room.capacityChildren > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4.5 w-4.5 text-emerald-600" />
                    <span>{room.capacityChildren} Children</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4.5 w-4.5 text-emerald-600" />
                  <span>{room.totalRooms} Rooms Available</span>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-black text-slate-900">Suite Configurations & Amenities</h2>
                <p className="text-slate-600 font-medium leading-relaxed">{room.description}</p>
              </div>

              {/* Room amenities details */}
              {roomAmenities.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-50">
                  {roomAmenities.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right booking sidebar */}
          <div className="lg:col-span-1">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden sticky top-24">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Book Suite</h3>
                  <p className="text-slate-500 font-medium text-xs mt-1">Check availability and calculate price dynamically.</p>
                </div>

                {!isLoggedIn ? (
                  /* Guest User Form Block Warning */
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-100 text-amber-800 p-5 rounded-2xl flex items-start gap-3 text-sm font-semibold leading-relaxed">
                      <Lock className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-amber-900">Sign In Required</p>
                        <p className="mt-1 text-xs text-amber-800 font-medium">To keep escrow transactions secure, users must sign in to request room bookings.</p>
                      </div>
                    </div>

                    <Link href={`/customer/login?callbackUrl=/hotels/rooms/${room.id}`} className="block">
                      <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-md shadow-emerald-500/10">
                        Sign In to Request Room
                      </Button>
                    </Link>
                  </div>
                ) : (
                  /* Logged-in Booking Form Block */
                  <form onSubmit={handleBookingSubmit} className="space-y-5">
                    {bookingError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-semibold leading-relaxed">
                        <AlertCircle className="h-4.5 w-4.5 text-rose-700 shrink-0" />
                        <span>{bookingError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Check-in</label>
                        <div className="relative">
                          <Input
                            type="date"
                            required
                            value={checkIn}
                            onChange={(e) => setCheckIn(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="h-11 rounded-xl pr-3 pl-3 border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/20 text-slate-800 font-semibold text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Check-out</label>
                        <div className="relative">
                          <Input
                            type="date"
                            required
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
                            min={checkIn || new Date().toISOString().split("T")[0]}
                            className="h-11 rounded-xl pr-3 pl-3 border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/20 text-slate-800 font-semibold text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rooms Needed</label>
                      <select
                        value={numberOfRooms}
                        onChange={(e) => setNumberOfRooms(parseInt(e.target.value))}
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold"
                      >
                        {Array.from({ length: room.totalRooms }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1} Room{i > 0 ? "s" : ""}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Guest Name</label>
                      <Input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/20 text-slate-800 font-semibold text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                      <Input
                        type="tel"
                        required
                        placeholder="e.g. +23288123456"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-emerald-500/20 text-slate-800 font-semibold text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adults</label>
                        <select
                          value={adults}
                          onChange={(e) => setAdults(parseInt(e.target.value))}
                          className="w-full h-11 border border-slate-200 rounded-xl px-3 text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold"
                        >
                          {[1, 2, 3, 4, 5, 6].map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Children</label>
                        <select
                          value={children}
                          onChange={(e) => setChildren(parseInt(e.target.value))}
                          className="w-full h-11 border border-slate-200 rounded-xl px-3 text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-semibold"
                        >
                          {[0, 1, 2, 3, 4].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {totalNights > 0 && (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-600 space-y-2">
                        <div className="flex justify-between">
                          <span>Price Per Night:</span>
                          <span className="font-bold text-slate-900">{formatCurrency(room.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Nights of Stay:</span>
                          <span className="font-bold text-slate-900">{totalNights} Night{totalNights > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Number of Rooms:</span>
                          <span className="font-bold text-slate-900">{numberOfRooms} Room{numberOfRooms > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                          <span>Total Price:</span>
                          <span className="font-black text-emerald-600 text-base">{formatCurrency(calculatedTotalPrice)}</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-xs font-semibold text-slate-600 space-y-1">
                      <p className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Cancellation Policy
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 font-medium leading-normal">
                        Free cancellation with 100% wallet refund is available up to 24 hours before your check-in date. Bookings are non-refundable after this window.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={bookingLoading}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5"
                    >
                      {bookingLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Processing Booking...
                        </>
                      ) : (
                        "Book Suite Now"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
