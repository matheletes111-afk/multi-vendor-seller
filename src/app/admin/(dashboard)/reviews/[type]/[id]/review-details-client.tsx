"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Star, ArrowLeft } from "lucide-react"

type ReviewDetail = {
  id: string
  rating: number
  comment: string | null
  images: string[]
  createdAt: string
  isVerified: boolean
  customerName: string | null
  customerEmail: string | null
  customerImage: string | null
  orderNumber: string | null
  sellerStoreName: string | null
}

type AdminReviewDetailsResponse = {
  reviewType: "product" | "service" | "hotel" | "food"
  itemId: string
  itemName: string
  itemImage: string | null
  avgRating: number
  reviewCount: number
  reviews: ReviewDetail[]
}

export function AdminReviewDetailsClient({ type, id }: { type: string; id: string }) {
  const [data, setData] = useState<AdminReviewDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/admin/reviews/${type}/${id}`, { credentials: "include", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load reviews")
        return r.json()
      })
      .then((json) => setData(json as AdminReviewDetailsResponse))
      .catch((e) => {
        if (e?.name === "AbortError") return
        setError(e?.message ?? "Failed to load reviews")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [type, id])

  if (loading && !data) return <PageLoader variant="detail" message="Loading reviews…" />
  if (error) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <p className="text-destructive font-medium">{error}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/admin/reviews">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reviews
          </Link>
        </Button>
      </div>
    )
  }

  const reviews = data?.reviews ?? []

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-400">
            {data?.itemImage ? (
              <img src={data.itemImage} alt={data?.itemName ?? "Item"} className="h-full w-full object-cover" />
            ) : (
              <span>{data?.itemName?.charAt(0)?.toUpperCase() ?? "?"}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{data?.itemName ?? "Item"}</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
              {data?.reviewType} Review Breakdown
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="inline-flex items-center gap-1 font-bold border-amber-200 bg-amber-50 text-amber-900 px-3 py-1 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            {(data?.avgRating ?? 0).toFixed(1)} / 5
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold">{data?.reviewCount ?? 0} review(s)</Badge>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card className="rounded-2xl border-none shadow-sm">
          <CardContent className="py-16 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-base font-semibold text-slate-700">No reviews found</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-2 bg-muted/20">
                <CardTitle className="text-sm flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="inline-flex items-center gap-1 font-bold border-amber-200 bg-amber-50 text-amber-900">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      {r.rating}/5
                    </Badge>
                    {r.isVerified && <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Verified</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">
                    {r.customerImage ? (
                      <img src={r.customerImage} alt={r.customerName || r.customerEmail || "Customer"} className="h-full w-full object-cover" />
                    ) : (
                      <span>{(r.customerName || r.customerEmail || "C").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="font-semibold text-slate-900 text-sm">{r.customerName || r.customerEmail || "Customer"}</span>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                      {r.customerEmail && <span>{r.customerEmail}</span>}
                      {r.orderNumber ? <span>• Order #{r.orderNumber}</span> : null}
                      {r.sellerStoreName ? <span>• Store: {r.sellerStoreName}</span> : null}
                    </div>
                  </div>
                </div>
                {r.comment ? <p className="whitespace-pre-wrap text-sm text-slate-700 font-medium pl-12">{r.comment}</p> : <p className="text-sm text-muted-foreground italic pl-12">No text comment</p>}
                {r.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-12 pt-1">
                    {r.images.map((url, idx) => (
                      <a key={`${r.id}-${idx}`} href={url} target="_blank" rel="noreferrer" className="block relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Review image ${idx + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button asChild variant="outline" className="rounded-xl">
        <Link href="/admin/reviews">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reviews
        </Link>
      </Button>
    </div>
  )
}
