"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Star, ArrowLeft, Clock, Flame, ShoppingBag, Plus, Minus, ShieldAlert } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Textarea } from "@/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { PublicLayout } from "@/components/site-layout"

type FoodReviewItem = {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string | null
  images?: any
  createdAt: string
}

type FoodItem = {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  images: any
  category: string
  isVeg: boolean
  averageRating: number
  totalReviews: number
  restaurantName: string
  reviews: FoodReviewItem[]
}

export default function FoodDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [food, setFood] = useState<FoodItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Review Form States
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchFoodDetails = async () => {
    try {
      const res = await fetch(`/api/customer/foods/${id}`)
      const data = await res.json()
      if (data.success) {
        setFood(data.data)
        // If customer has an existing review, pre-fill
        if (session?.user?.id && data.data.reviews) {
          const userReview = data.data.reviews.find((r: FoodReviewItem) => r.userId === session.user.id)
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
      console.error("Failed to load food details:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchFoodDetails()
  }, [id, session?.user?.id])

  const handleQuantityChange = (type: "inc" | "dec") => {
    if (type === "inc") {
      setQuantity(prev => prev + 1)
    } else {
      setQuantity(prev => (prev > 1 ? prev - 1 : 1))
    }
  }

  const handleOrderNow = () => {
    if (!session) {
      router.push(`/customer/login?callbackUrl=/foods/${id}`)
      return
    }
    if (session.user.role !== "CUSTOMER") {
      alert("Only customers can order food items.")
      return
    }
    router.push(`/foods/checkout?foodItemId=${food?.id}&quantity=${quantity}`)
  }

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
    setSubmittingReview(true)
    setReviewMessage(null)

    const existingReview = food?.reviews?.find(r => r.userId === session?.user?.id)
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

      const res = await fetch(`/api/customer/foods/${id}/reviews`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, imageUrls: finalImageUrls })
      })

      const data = await res.json()
      if (data.success) {
        setReviewMessage({
          type: "success",
          text: existingReview ? "Review updated successfully!" : "Review submitted successfully!"
        })
        setReviewFiles([])
        fetchFoodDetails()
      } else {
        setReviewMessage({ type: "error", text: data.error || "Something went wrong." })
      }
    } catch (err: any) {
      setReviewMessage({ type: "error", text: err.message || "Failed to connect to the server." })
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 max-w-6xl text-center space-y-4">
          <div className="h-16 w-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">Loading delicious details...</p>
        </div>
      </PublicLayout>
    )
  }

  if (!food) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 max-w-xl text-center space-y-6">
          <ShieldAlert className="h-16 w-16 text-rose-500 mx-auto" />
          <h2 className="text-2xl font-black text-slate-800">Food Item Not Found</h2>
          <p className="text-slate-500">The food item you are looking for does not exist or has been removed.</p>
          <Link href="/foods">
            <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold px-6 py-3">
              Back to Foods
            </Button>
          </Link>
        </div>
      </PublicLayout>
    )
  }

  const existingUserReview = food.reviews.find(r => r.userId === session?.user?.id)

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8 animate-in fade-in duration-500">
        {/* Back Button */}
        <div>
          <Link href="/foods" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-500 transition-colors bg-white/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Back to menu
          </Link>
        </div>

        {/* Hero Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Image Gallery / Banner */}
          {(() => {
            let foodImages: string[] = []
            if (food) {
              if (Array.isArray(food.images)) {
                foodImages = food.images
              } else if (food.images && typeof food.images === 'string') {
                try {
                  foodImages = JSON.parse(food.images)
                } catch {}
              }
              if (foodImages.length === 0 && food.image) {
                foodImages = [food.image]
              }
            }
            return (
              <div className="space-y-4 w-full">
                <div className="bg-white rounded-[2.5rem] p-4 border border-slate-100 shadow-xl overflow-hidden aspect-[4/3] relative flex items-center justify-center">
                  {foodImages.length > 0 ? (
                    <img src={foodImages[activeImageIndex] || foodImages[0]} alt={food.name} className="object-cover w-full h-full rounded-[2rem]" />
                  ) : (
                    <div className="text-slate-300 font-black text-xl flex flex-col items-center gap-3">
                      <Flame className="h-20 w-20 text-rose-500/20" />
                      No image available
                    </div>
                  )}
                  <span className={`absolute top-8 left-8 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                    food.isVeg ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {food.isVeg ? "Veg" : "Non-Veg"}
                  </span>
                </div>
                
                {/* Thumbnail selector */}
                {foodImages.length > 1 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-2">
                    {foodImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-20 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                          activeImageIndex === idx ? "border-rose-500 scale-105 shadow-md" : "border-slate-200 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={img} alt={`${food.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Core Info */}
          <div className="space-y-6">
            <div className="space-y-3">
              <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest w-fit">
                {food.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{food.name}</h1>
              <p className="text-sm font-bold text-slate-400">Offered by <span className="text-slate-700">{food.restaurantName}</span></p>

              {food.totalReviews > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-sm font-black text-amber-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>{food.averageRating}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">({food.totalReviews} rating{food.totalReviews === 1 ? "" : "s"})</span>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400">No ratings yet</p>
              )}
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-2">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Description</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">{food.description || "No description provided."}</p>
            </div>

            <hr className="border-slate-100" />

            {/* Ordering Options */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-lg space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Price per item</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(food.price)}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Quantity</p>
                  <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50">
                    <button
                      onClick={() => handleQuantityChange("dec")}
                      className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-4 font-black text-slate-800 text-sm">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange("inc")}
                      className="p-2 rounded-xl text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Subtotal</p>
                  <p className="text-xl font-black text-slate-950 mt-0.5">{formatCurrency(food.price * quantity)}</p>
                </div>

                <Button
                  onClick={handleOrderNow}
                  className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest px-6 h-12 flex items-center gap-2 shadow-lg shadow-rose-500/20"
                >
                  <ShoppingBag className="h-4 w-4" /> Order Now
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-6">
          {/* Reviews list */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Customer Reviews</h2>
            {food.reviews.length === 0 ? (
              <div className="text-center py-12 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                <p className="text-slate-500 font-bold text-sm">No reviews yet for this item.</p>
                <p className="text-slate-400 text-xs mt-1">Be the first to order and review!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {food.reviews.map((review) => (
                  <Card key={review.id} className="rounded-3xl border-none shadow-sm bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center text-xs font-black text-rose-600">
                          {review.userName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{review.userName}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-black text-amber-700">{review.rating}</span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs font-semibold leading-relaxed">
                      {review.comment || "No comment left."}
                    </p>

                    {review.images && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(Array.isArray(review.images) ? review.images : JSON.parse(review.images || "[]")).map((img: string, idx: number) => (
                          <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0">
                            <img src={img} alt="Review attachment" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Submit/Edit Review Form */}
          {session && session.user.role === "CUSTOMER" && (
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-md space-y-4">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                {existingUserReview ? "Edit Your Review" : "Rate this Dish"}
              </h3>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rating</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Star className={`h-6 w-6 ${
                          star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Comments</label>
                  <Textarea
                    placeholder="Tell us what you liked or disliked about this dish..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="rounded-xl border-slate-200 text-xs h-24"
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

                {reviewMessage && (
                  <div className={`px-4 py-2.5 rounded-xl text-xs font-bold ${
                    reviewMessage.type === "success" 
                      ? "bg-emerald-50 border border-emerald-100 text-emerald-700" 
                      : "bg-rose-50 border border-rose-100 text-rose-700"
                  }`}>
                    {reviewMessage.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider h-10 shadow-sm"
                >
                  {submittingReview ? "Submitting..." : existingUserReview ? "Update Review" : "Submit Review"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
