"use client"

import { Star } from "lucide-react"

export type PublicReviewItem = {
  id: string
  rating: number
  comment: string | null
  images: string[]
  createdAt: string
  reviewerName: string
  isVerified: boolean
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Recently"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

function StarRow({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <div className="flex items-center gap-0.5" aria-label={`${safeRating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`${size} ${index < safeRating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
        />
      ))}
    </div>
  )
}

export function PublicReviewsSection({
  averageRating,
  totalReviews,
  reviews,
}: {
  averageRating: number
  totalReviews: number
  reviews: PublicReviewItem[]
}) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6 sm:mt-10 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Ratings & reviews</h2>
          <p className="mt-1 text-sm text-slate-600">Real customer feedback from completed orders.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-xs text-slate-500">Average rating</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{averageRating.toFixed(1)}</span>
            <StarRow rating={averageRating} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{totalReviews} review{totalReviews === 1 ? "" : "s"}</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          No reviews yet. Be the first to review after purchase.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StarRow rating={review.rating} />
                  <p className="text-sm font-semibold text-slate-900">{review.reviewerName}</p>
                  {review.isVerified && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                      Verified buyer
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{formatReviewDate(review.createdAt)}</p>
              </div>
              {review.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{review.comment}</p>
              )}
              {review.images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {review.images.map((imageUrl, index) => (
                    <a
                      key={`${review.id}-${index}`}
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={imageUrl}
                        alt={`Review image ${index + 1}`}
                        className="h-20 w-full object-cover sm:h-24"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

