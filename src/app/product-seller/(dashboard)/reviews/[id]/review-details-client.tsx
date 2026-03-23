"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Star } from "lucide-react"

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

type ReviewDetailsResponse = {
  productId: string
  productName: string
  productImage: string | null
  avgRating: number
  reviewCount: number
  reviews: ReviewDetail[]
}

export function ReviewDetailsClient({ productId }: { productId: string }) {
  const [data, setData] = useState<ReviewDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/product-seller/reviews/${productId}`, { credentials: "include", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load reviews")
        return r.json()
      })
      .then((json) => setData(json as ReviewDetailsResponse))
      .catch((e) => {
        if (e?.name === "AbortError") return
        setError(e?.message ?? "Failed to load reviews")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [productId])

  if (loading && !data) return <PageLoader variant="detail" message="Loading reviews…" />
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/product-seller/reviews">Back</Link>
        </Button>
      </div>
    )
  }

  const reviews = data?.reviews ?? []

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded border bg-slate-100">
            {data?.productImage ? (
              <img src={data.productImage} alt={data?.productName ?? "Product"} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Product reviews</h1>
          <p className="mt-2 text-muted-foreground">{data?.productName ?? "Product"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
            {(data?.avgRating ?? 0).toFixed(1)}/5
          </Badge>
          <Badge variant="secondary">{data?.reviewCount ?? 0} review(s)</Badge>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No reviews yet</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      {r.rating}/5
                    </Badge>
                    {r.isVerified && <span className="text-xs text-emerald-700 font-medium">Verified</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border bg-slate-100">
                    {r.customerImage ? (
                      <img src={r.customerImage} alt={r.customerName || r.customerEmail || "Customer"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{r.customerName || r.customerEmail || "Customer"}</span>
                    {r.orderNumber ? <span> • Order #{r.orderNumber}</span> : null}
                  </div>
                </div>
                {r.comment ? <p className="whitespace-pre-wrap text-sm">{r.comment}</p> : <p className="text-sm text-muted-foreground">—</p>}
                {r.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {r.images.map((url, idx) => (
                      <a key={`${r.id}-${idx}`} href={url} target="_blank" rel="noreferrer" className="block">
                        <img src={url} alt={`Review image ${idx + 1}`} className="h-24 w-full rounded border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button asChild variant="outline">
        <Link href="/product-seller/reviews">Back to reviews</Link>
      </Button>
    </div>
  )
}

