"use client"

import { useState, useEffect } from "react"
import { Star, MessageSquare, Loader2, ArrowLeft, Calendar, Building2 } from "lucide-react"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"

type GroupedHotel = {
  hotelId: string
  hotelName: string
  hotelImage: string | null
  avgRating: string
  reviewCount: number
  latestReviewAt: string | null
}

type HotelReviewDetail = {
  id: string
  rating: number
  comment: string | null
  images: any
  createdAt: string
  userName: string
  userEmail: string
}

type DetailResponse = {
  hotelId: string
  hotelName: string
  hotelImage: string | null
  avgRating: string
  reviewCount: number
  reviews: HotelReviewDetail[]
}

export function HotelReviewsClient() {
  const [groupedHotels, setGroupedHotels] = useState<GroupedHotel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<DetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchGroupedReviews = async () => {
    try {
      const res = await fetch("/api/hotel-seller/reviews")
      const data = await res.json()
      if (data.success) {
        setGroupedHotels(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchHotelReviewDetails = async (hotelId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/hotel-seller/reviews/${hotelId}`)
      const data = await res.json()
      if (data.success) {
        setDetailData(data.data)
        setSelectedHotelId(hotelId)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    fetchGroupedReviews()
  }, [])

  const averageRatingOverall = groupedHotels.length > 0
    ? parseFloat((groupedHotels.reduce((acc, item) => acc + parseFloat(item.avgRating), 0) / groupedHotels.length).toFixed(1))
    : 0

  const totalReviewsCount = groupedHotels.reduce((acc, item) => acc + item.reviewCount, 0)

  if (selectedHotelId && detailData) {
    return (
      <div className="space-y-6 p-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedHotelId(null)
              setDetailData(null)
            }}
            className="rounded-xl border border-slate-200 bg-white shadow-sm font-bold text-xs uppercase"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Summary
          </Button>
        </div>

        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
              {detailData.hotelImage ? (
                <img src={detailData.hotelImage} alt={detailData.hotelName} className="object-cover h-full w-full" />
              ) : (
                <Building2 className="h-6 w-6 text-slate-300" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">{detailData.hotelName}</h2>
              <p className="text-slate-400 text-xs font-semibold mt-1">Average rating across {detailData.reviewCount} guest stay reviews</p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Rating</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
                <span className="text-2xl font-black text-slate-950">{detailData.avgRating}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {detailData.reviews.map(review => (
            <Card key={review.id} className="rounded-3xl border-none shadow-sm bg-white p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">{review.userName}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{review.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-black text-amber-700">{review.rating}</span>
                  </div>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed font-semibold">
                  {review.comment || "No comments left."}
                </p>

                {review.images && Array.isArray(review.images) && (review.images as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {(review.images as string[]).map((img: string, idx: number) => (
                      <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0">
                        <img src={img} alt="Review attachment" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-50 pt-3 flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-slate-300" />
                <span>Reviewed on {new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hotel Reviews</h1>
        <p className="text-muted-foreground mt-2">See what your guests are saying about your properties hotel-wise.</p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-3xl border-none shadow-md bg-white p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Rating</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{averageRatingOverall} / 5</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          </div>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Feedback</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalReviewsCount}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
            <MessageSquare className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
          <p className="text-slate-500 font-medium mt-3 text-sm">Loading hotel reviews list...</p>
        </div>
      ) : groupedHotels.length === 0 ? (
        <Card className="rounded-[2rem] border-none shadow-md text-center py-16">
          <CardContent className="space-y-4">
            <MessageSquare className="h-16 w-16 text-slate-300 mx-auto" />
            <h3 className="text-lg font-black text-slate-800">No Reviews Found</h3>
            <p className="text-slate-500 text-xs mt-1">Guests haven&apos;t left any ratings on your hotels yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groupedHotels.map(item => (
            <Card key={item.hotelId} className="rounded-3xl border-none shadow-md bg-white p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {item.hotelImage ? (
                    <img src={item.hotelImage} alt={item.hotelName} className="object-cover h-full w-full" />
                  ) : (
                    <Building2 className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-800 truncate mt-0.5">{item.hotelName}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Rating</span>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      <span className="text-xs font-black text-slate-900">{item.avgRating}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Reviews</span>
                    <span className="text-xs font-black text-slate-800 mt-0.5 block">{item.reviewCount}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={loadingDetail}
                  onClick={() => fetchHotelReviewDetails(item.hotelId)}
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider px-3 h-8 shadow-sm"
                >
                  View Reviews
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
