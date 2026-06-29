"use client"

import { useState, useEffect } from "react"
import { Star, MessageSquare, Flame, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"

type FoodReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  customerName: string
  customerEmail: string
  foodItem: {
    id: string
    name: string
    image: string | null
    category: string
  }
}

export function RestaurantReviewsClient() {
  const [reviews, setReviews] = useState<FoodReview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRating, setSelectedRating] = useState<number | "ALL">("ALL")

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/restaurant-seller/reviews")
      const data = await res.json()
      if (data.success) {
        setReviews(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const filteredReviews = reviews.filter(r => {
    return selectedRating === "ALL" || r.rating === selectedRating
  })

  // Calculations
  const totalReviewsCount = reviews.length
  const averageRating = totalReviewsCount > 0 
    ? parseFloat((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviewsCount).toFixed(1))
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reviews &amp; Ratings</h1>
          <p className="text-slate-500 font-medium text-sm">Analyze feedback and star ratings from your customers.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {["ALL", 5, 4, 3, 2, 1].map(stars => (
            <button
              key={stars}
              onClick={() => setSelectedRating(stars as any)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                selectedRating === stars
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {stars === "ALL" ? "All Stars" : `${stars} Star${stars === 1 ? "" : "s"}`}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-white p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Rating</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{averageRating} / 5</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          </div>
        </Card>

        <Card className="rounded-3xl border-none shadow-sm bg-white p-5 flex items-center justify-between">
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
          <p className="text-slate-500 font-medium mt-3 text-sm">Loading feedback feed...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card className="rounded-[2rem] border-none shadow-sm text-center py-16">
          <CardContent className="space-y-4">
            <MessageSquare className="h-16 w-16 text-slate-300 mx-auto" />
            <h3 className="text-lg font-black text-slate-800">No Reviews Found</h3>
            <p className="text-slate-500 text-xs mt-1">No customer reviews matched this filter criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredReviews.map(review => (
            <Card key={review.id} className="rounded-3xl border-none shadow-sm bg-white p-5 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">{review.customerName}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{review.customerEmail}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-black text-amber-700">{review.rating}</span>
                  </div>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed font-semibold">
                  {review.comment || "No comments left."}
                </p>
              </div>

              <div className="border-t border-slate-50 pt-3 flex items-center gap-3">
                <div className="h-9 w-9 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  {review.foodItem.image ? (
                    <img src={review.foodItem.image} alt={review.foodItem.name} className="object-cover h-full w-full" />
                  ) : (
                    "Food"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate leading-tight">{review.foodItem.name}</p>
                  <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mt-1 inline-block">
                    {review.foodItem.category}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
