"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Star, MapPin, Building2, CheckCircle2, ChevronRight, User, Users, Coffee, ShieldAlert, ArrowLeft, MessageSquare } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"
import { useSession } from "next-auth/react"

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

type HotelReviewItem = {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string | null
  images?: any
  createdAt: string
}

type Hotel = {
  id: string
  name: string
  description: string | null
  starRating: number
  averageRating?: number
  totalReviews?: number
  address: string | null
  city: string | null
  state: string | null
  checkInPolicy: string | null
  checkOutPolicy: string | null
  amenities: any
  images: any
  rooms: Room[]
  reviews?: HotelReviewItem[]
}

export default function HotelDetailsPage() {
  const { id } = useParams()
  const { data: session } = useSession()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)

  // Review form state
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchHotelDetails = async () => {
    try {
      const res = await fetch(`/api/hotels/${id}`)
      const data = await res.json()
      if (data.success) {
        setHotel(data.data)
        // If logged in customer has an existing review, pre-fill it
        if (session?.user?.id && data.data.reviews) {
          const userReview = data.data.reviews.find((r: HotelReviewItem) => r.userId === session.user.id)
          if (userReview) {
            setRating(userReview.rating)
            setComment(userReview.comment || "")
            if (userReview.images) {
              let rImages: string[] = []
              if (Array.isArray(userReview.images)) {
                rImages = userReview.images
              } else if (typeof userReview.images === "string") {
                try {
                  rImages = JSON.parse(userReview.images)
                } catch {}
              }
              setReviewPreviews(rImages)
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to load hotel details:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchHotelDetails()
  }, [id, session?.user?.id])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).slice(0, 5)
      setReviewFiles(selected)
      const previews = selected.map(file => URL.createObjectURL(file))
      setReviewPreviews(previews)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const existingReview = hotel?.reviews?.find(r => r.userId === session?.user?.id)
    const method = existingReview ? "PUT" : "POST"

    try {
      const uploadedUrls: string[] = []
      if (reviewFiles.length > 0) {
        for (const file of reviewFiles) {
          const fd = new FormData()
          fd.append("file", file)
          const uploadRes = await fetch("/api/customer/review-upload", {
            method: "POST",
            body: fd
          })
          const uploadJson = await uploadRes.json().catch(() => ({}))
          if (uploadJson?.url) {
            uploadedUrls.push(uploadJson.url)
          } else {
            throw new Error(uploadJson?.error || "Failed to upload image")
          }
        }
      }

      const finalImageUrls = [
        ...reviewPreviews.filter(url => !url.startsWith("blob:")),
        ...uploadedUrls
      ].slice(0, 5)

      const res = await fetch(`/api/hotels/${id}/reviews`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, imageUrls: finalImageUrls })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: "success", text: existingReview ? "Review updated successfully!" : "Review submitted successfully!" })
        setReviewFiles([])
        fetchHotelDetails()
      } else {
        setMessage({ type: "error", text: data.error || "Failed to submit review." })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Something went wrong. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

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

  const reviewsList = hotel.reviews || []
  const hasUserReview = reviewsList.some(r => r.userId === session?.user?.id)

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

                    {(!session || session?.user?.role === "CUSTOMER") && (
                      <Link href={`/hotels/rooms/${room.id}`}>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest h-11 px-5 shadow-md shadow-emerald-500/10 flex items-center gap-1">
                          Book Room <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Ratings & Reviews Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-slate-100">
        {/* Reviews List */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Guest Reviews</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Real feedback shared by guests who stayed here.</p>
          </div>

          {reviewsList.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-8 text-center">
              <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-semibold">No reviews yet for this hotel.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewsList.map((review) => (
                <div key={review.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                        {review.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{review.userName}</h4>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-3 w-3 ${idx < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-slate-600 text-sm font-medium leading-relaxed pl-12">{review.comment}</p>
                  )}
                  {review.images && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-12">
                      {(Array.isArray(review.images) ? review.images : JSON.parse(review.images || "[]")).map((img: string, idx: number) => (
                        <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0">
                          <img src={img} alt="Review attachment" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Write a Review Block */}
        <div className="lg:col-span-1">
          {session?.user?.role === "CUSTOMER" ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 sticky top-24">
              <h3 className="text-lg font-black text-slate-900 pb-2 border-b border-slate-50">
                {hasUserReview ? "Edit Your Review" : "Write a Review"}
              </h3>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rating</label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRating(val)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`h-7 w-7 ${val <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Experience</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Describe your stay, rooms, cleanliness..."
                    className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attach Photos (Max 5)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {reviewPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {reviewPreviews.map((url, index) => (
                        <div key={index} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0">
                          <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {message && (
                  <p className={`text-xs font-bold ${message.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                    {message.text}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-wider py-3"
                >
                  {submitting ? "Submitting..." : hasUserReview ? "Update Review" : "Submit Review"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-center sticky top-24 space-y-3">
              <Building2 className="h-6 w-6 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">Want to review this stay?</h4>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                Log in as a customer with a confirmed booking to share your experience.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
