"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeThumbnailUrl } from "@/lib/youtube"
import { Megaphone, Check, X, ImageIcon, Video } from "lucide-react"

type Ad = {
  id: string
  title: string
  description: string | null
  creativeType: string
  creativeUrl: string
  status: string
  totalBudget: number
  spentAmount: number
  maxCpc: number
  startAt: Date
  endAt: Date
  seller: {
    user: { email: string | null; name: string | null }
    store: { name: string | null } | null
  }
  product: { id: string; name: string } | null
  service: { id: string; name: string } | null
  _count: { adClicks: number }
}

export function AdminSellerAdsPageClient({
  ads,
  params,
  approveAd,
  rejectAd,
}: {
  ads: Ad[]
  params: { error?: string; success?: string }
  approveAd: (adId: string) => Promise<{ error?: string }>
  rejectAd: (adId: string) => Promise<{ error?: string }>
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return <Badge variant="secondary">Pending approval</Badge>
      case "ACTIVE":
        return <Badge variant="default">Active</Badge>
      case "PAUSED":
        return <Badge variant="outline">Paused</Badge>
      case "ENDED":
        return <Badge variant="secondary">Ended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seller Ads</h1>
        <p className="text-muted-foreground mt-2">Approve or reject seller-created ads. Only approved ads show in Sponsored.</p>
      </div>

      {params.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert className="mb-6">
          <AlertDescription>{decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      {ads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No seller ads yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <Card key={ad.id} className="overflow-hidden">
              <div className="aspect-video relative bg-muted">
                {ad.creativeType === "VIDEO" ? (
                  getYoutubeThumbnailUrl(ad.creativeUrl) ? (
                    <img src={getYoutubeThumbnailUrl(ad.creativeUrl)!} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <video src={ad.creativeUrl} className="w-full h-full object-cover" muted preload="metadata" playsInline />
                  )
                ) : (
                  <Image src={ad.creativeUrl} alt={ad.title} fill className="object-cover" unoptimized />
                )}
                <div className="absolute top-2 right-2">
                  {ad.creativeType === "VIDEO" ? <Video className="h-4 w-4 text-white drop-shadow" /> : <ImageIcon className="h-4 w-4 text-white drop-shadow" />}
                </div>
              </div>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-lg">{ad.title}</CardTitle>
                  {statusBadge(ad.status)}
                </div>
                <CardDescription>
                  {ad.product ? `Product: ${ad.product.name}` : ad.service ? `Service: ${ad.service.name}` : "—"}
                  <span className="block mt-1">{ad.seller.store?.name || ad.seller.user.email}</span>
                  <span className="block text-xs mt-1">Clicks: {ad._count.adClicks} · Spent: {formatCurrency(ad.spentAmount)} / {formatCurrency(ad.totalBudget)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ad.status === "PENDING_APPROVAL" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={loadingId === ad.id}
                      onClick={async () => {
                        setLoadingId(ad.id)
                        await approveAd(ad.id)
                        setLoadingId(null)
                      }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={loadingId === ad.id}
                      onClick={async () => {
                        setLoadingId(ad.id)
                        await rejectAd(ad.id)
                        setLoadingId(null)
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
