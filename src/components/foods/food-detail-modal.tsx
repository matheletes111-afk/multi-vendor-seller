"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import { Star, Plus, Minus, X, ShoppingBag, MessageSquare, Sparkles, ChevronLeft, ChevronRight, Image as ImageIcon, Edit2, Lock, Check } from "lucide-react"

type FoodReview = {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string | null
  images: string[]
  createdAt: string
}

type FoodDetailData = {
  id: string
  name: string
  description: string | null
  price: number
  images: string[]
  image: string | null
  category: string
  isVeg: boolean
  averageRating: number
  totalReviews: number
  restaurantName: string
  restaurantSellerId: string
  userHasPurchased?: boolean
  userReview?: FoodReview | null
  reviews: FoodReview[]
}

type FoodDetailModalProps = {
  foodItemId: string | null
  isOpen: boolean
  onClose: () => void
  onAddToCart?: (item: any, quantity: number) => void
  getItemQty?: (foodItemId: string) => number
}

const FALLBACK_FOOD_IMAGES: Record<string, string> = {
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  biryani: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80",
  sushi: "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600&q=80",
  tacos: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
  dessert: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
}

function getFallbackFoodImage(category?: string, name?: string): string {
  const key = [category || "", name || ""].join(" ").toLowerCase()
  for (const [k, v] of Object.entries(FALLBACK_FOOD_IMAGES)) {
    if (key.includes(k)) return v
  }
  return FALLBACK_FOOD_IMAGES.default
}

export function FoodDetailModal({
  foodItemId,
  isOpen,
  onClose,
  onAddToCart,
  getItemQty,
}: FoodDetailModalProps) {
  const [food, setFood] = useState<FoodDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)

  // Review Form state
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [isEditingReview, setIsEditingReview] = useState(false)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState("")
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)

  useEffect(() => {
    if (foodItemId && isOpen) {
      setLoading(true)
      setActiveImageIdx(0)
      setShowReviewForm(false)
      setIsEditingReview(false)
      setReviewMessage(null)
      setImageUrls([])
      setNewImageUrl("")

      const initialQty = getItemQty ? getItemQty(foodItemId) : 1
      setQuantity(initialQty > 0 ? initialQty : 1)

      fetch(`/api/customer/foods/${foodItemId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success) {
            setFood(data.data)
            if (data.data.userReview) {
              setNewRating(data.data.userReview.rating || 5)
              setNewComment(data.data.userReview.comment || "")
              setImageUrls(Array.isArray(data.data.userReview.images) ? data.data.userReview.images : [])
            } else {
              setNewRating(5)
              setNewComment("")
              setImageUrls([])
            }
          } else {
            setFood(null)
          }
        })
        .catch((err) => {
          console.error("Error loading food detail:", err)
          setFood(null)
        })
        .finally(() => setLoading(false))
    } else {
      setFood(null)
    }
  }, [foodItemId, isOpen, getItemQty])

  const handleOpenReviewForm = () => {
    if (food?.userReview) {
      setIsEditingReview(true)
      setNewRating(food.userReview.rating)
      setNewComment(food.userReview.comment || "")
      setImageUrls(Array.isArray(food.userReview.images) ? food.userReview.images : [])
    } else {
      setIsEditingReview(false)
      setNewRating(5)
      setNewComment("")
      setImageUrls([])
    }
    setShowReviewForm(true)
  }

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return
    if (imageUrls.length >= 3) {
      setReviewMessage("Maximum 3 images allowed per review.")
      return
    }
    setImageUrls([...imageUrls, newImageUrl.trim()])
    setNewImageUrl("")
  }

  const handleRemoveImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const handlePostReview = async () => {
    if (!foodItemId) return
    setSubmittingReview(true)
    setReviewMessage(null)

    const method = isEditingReview ? "PUT" : "POST"

    try {
      const res = await fetch(`/api/customer/foods/${foodItemId}/reviews`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: newRating,
          comment: newComment.trim(),
          imageUrls: imageUrls
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setReviewMessage(isEditingReview ? "Review updated successfully!" : "Review submitted successfully!")
        setShowReviewForm(false)

        // Reload food data to update reviews
        const refreshRes = await fetch(`/api/customer/foods/${foodItemId}`)
        const refreshData = await refreshRes.json()
        if (refreshData && refreshData.success) {
          setFood(refreshData.data)
        }
      } else {
        setReviewMessage(data.error || "Failed to submit review.")
      }
    } catch {
      setReviewMessage("Failed to connect to server.")
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!isOpen) return null

  const rawImages = food
    ? food.images && food.images.length > 0
      ? food.images
      : food.image
      ? [food.image]
      : []
    : []

  const images = rawImages.length > 0 ? rawImages : [getFallbackFoodImage(food?.category, food?.name)]
  const currentQtyInCart = food && getItemQty ? getItemQty(food.id) : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{food?.name || "Food Item Details"}</DialogTitle>
        
        {/* Header / Gallery */}
        <div className="relative w-full h-64 sm:h-80 bg-slate-900 shrink-0 overflow-hidden group">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-slate-100">
              <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[activeImageIdx] || images[0]}
                alt={food?.name || "Food Item"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.onerror = null
                  target.src = getFallbackFoodImage(food?.category, food?.name)
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Gallery Navigation Controls */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImageIdx((prev) => (prev <= 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setActiveImageIdx((prev) => (prev >= images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        className={`h-2 rounded-full transition-all ${
                          activeImageIdx === idx ? "w-6 bg-amber-400" : "w-2 bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Badges Overlay */}
          {food && (
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 items-center z-10">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/95 backdrop-blur-md shadow-md ${
                  food.isVeg ? "text-emerald-700 border border-emerald-300" : "text-rose-700 border border-rose-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${food.isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
                {food.isVeg ? "Pure Veg" : "Non-Veg"}
              </span>

              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400 text-amber-950 shadow-md">
                {food.category}
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 h-9 w-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading || !food ? (
            <div className="space-y-4 py-8 text-center">
              <p className="text-slate-400 font-semibold text-sm">Loading dish info…</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dish Header Info */}
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> By {food.restaurantName}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight mt-0.5">{food.name}</h2>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-amber-600 leading-none">{formatCurrency(food.price)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Inclusive of taxes</p>
                  </div>
                </div>

                {/* Rating Badge */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1 rounded-full text-xs font-black">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>{food.averageRating > 0 ? food.averageRating : "New"}</span>
                    <span className="text-amber-700/60 font-semibold ml-1">({food.totalReviews} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Description</h4>
                <p className="text-slate-600 text-sm font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {food.description || "Prepared fresh to order using finest local ingredients and authentic culinary spices."}
                </p>
              </div>

              {/* Customer Reviews & Ratings Section */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-500" /> Ratings & Customer Reviews
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Feedback from verified customers</p>
                  </div>

                  {/* Review Button logic */}
                  {food.userHasPurchased ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (showReviewForm) {
                          setShowReviewForm(false)
                        } else {
                          handleOpenReviewForm()
                        }
                      }}
                      className="rounded-xl border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-bold flex items-center gap-1.5"
                    >
                      {showReviewForm ? (
                        "Cancel"
                      ) : food.userReview ? (
                        <>
                          <Edit2 className="h-3.5 w-3.5 text-amber-600" /> Edit Your Review
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 text-amber-600" /> Add Review
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                      <Lock className="h-3 w-3" /> Order required to review
                    </div>
                  )}
                </div>

                {/* Review Message Feedback */}
                {reviewMessage && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                    {reviewMessage}
                  </div>
                )}

                {/* Write/Edit Review Form */}
                {showReviewForm && (
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3 animate-in fade-in">
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      {isEditingReview ? "Edit Your Review" : "Write a Review"}
                    </h4>
                    
                    {/* Rating selector */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= newRating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-xs font-bold text-amber-900">{newRating} Stars</span>
                    </div>

                    {/* Comment text */}
                    <Textarea
                      placeholder="Share your experience with this dish..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className="bg-white rounded-xl text-xs border-slate-200"
                    />

                    {/* Review Images Upload/Url Section */}
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5 text-amber-500" /> Attach Photos (Image URLs)
                      </label>

                      <div className="flex gap-2">
                        <Input
                          placeholder="https://example.com/photo.jpg"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          className="bg-white text-xs h-9 rounded-xl border-slate-200 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddImageUrl}
                          className="h-9 px-3 rounded-xl border-amber-300 text-amber-900 font-bold text-xs"
                        >
                          Add Photo
                        </Button>
                      </div>

                      {/* Attached Image Previews */}
                      {imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {imageUrls.map((url, idx) => (
                            <div key={idx} className="relative h-14 w-14 rounded-xl overflow-hidden border border-slate-200 group/img">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Review photo ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveImageUrl(idx)}
                                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={handlePostReview}
                      disabled={submittingReview}
                      className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl h-9 px-5 shadow-sm"
                    >
                      {submittingReview ? "Saving..." : isEditingReview ? "Update Review" : "Submit Review"}
                    </Button>
                  </div>
                )}

                {/* Reviews List */}
                {food.reviews && food.reviews.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {food.reviews.map((rev) => (
                      <div key={rev.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs">{rev.userName}</span>
                            {food.userReview?.id === rev.id && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                Your Review
                              </span>
                            )}
                          </div>
                          <div className="flex text-amber-400 text-xs">
                            {Array.from({ length: rev.rating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </div>
                        </div>

                        {rev.comment && <p className="text-slate-600 text-xs font-medium leading-relaxed">{rev.comment}</p>}

                        {/* Review Attached Photos */}
                        {Array.isArray(rev.images) && rev.images.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {rev.images.map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imgUrl} alt="Customer review photo" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 font-semibold pt-0.5">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 text-xs font-bold">
                    No reviews yet. Be the first to try and review this dish!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Add To Cart CTA */}
        {food && (
          <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-4 shrink-0 shadow-lg">
            {/* Quantity Stepper */}
            <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-9 w-9 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-xs transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 font-black text-slate-900 text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="h-9 w-9 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Add / Update Cart CTA */}
            <Button
              onClick={() => {
                if (onAddToCart && food) {
                  onAddToCart(food, quantity)
                  onClose()
                }
              }}
              className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs uppercase tracking-widest shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              {currentQtyInCart > 0 ? "Update Cart" : "Add to Order"} • {formatCurrency(food.price * quantity)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
