"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeThumbnailUrl } from "@/lib/youtube"
import { Megaphone, Check, X, ImageIcon, Video } from "lucide-react"
import { AdminPagination, AdminPaginationProps } from "@/components/admin/admin-pagination"

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

export function AdminSellerAdsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

  const [data, setData] = useState<{
    ads: Ad[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const fetchAds = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/seller-ads?page=${page}&perPage=${perPage}`)
      if (!res.ok) throw new Error("Failed to fetch seller ads")
      const json = await res.json()
      setData(json)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [page, perPage])

  useEffect(() => {
    fetchAds()
  }, [fetchAds])

  const approveAd = async (adId: string) => {
    const res = await fetch(`/api/admin/seller-ads/${adId}/approve`, { method: "POST" })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Failed" }
    await fetchAds()
    router.replace("/admin/seller-ads?success=Approved")
    return {}
  }

  const rejectAd = async (adId: string) => {
    const res = await fetch(`/api/admin/seller-ads/${adId}/reject`, { method: "POST" })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Failed" }
    await fetchAds()
    router.replace("/admin/seller-ads?success=Rejected")
    return {}
  }

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
        <p className="text-muted-foreground mt-2">
          Approve or reject seller-created ads. Only approved ads show in Sponsored.
        </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Seller ads list</CardTitle>
          <CardDescription>All seller-created ads with status and performance</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : fetchError ? (
            <div className="py-12 text-center text-destructive">{fetchError}</div>
          ) : !data ? null : (
            <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Product / Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget / Spent</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No seller ads yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="relative w-24 h-14 rounded overflow-hidden bg-muted shrink-0">
                        {ad.creativeType === "VIDEO" ? (
                          getYoutubeThumbnailUrl(ad.creativeUrl) ? (
                            <img
                              src={getYoutubeThumbnailUrl(ad.creativeUrl)!}
                              alt={ad.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={ad.creativeUrl}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                              playsInline
                            />
                          )
                        ) : (
                          <Image
                            src={ad.creativeUrl}
                            alt={ad.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        )}
                        <div className="absolute bottom-0.5 right-0.5">
                          {ad.creativeType === "VIDEO" ? (
                            <Video className="h-3 w-3 text-white drop-shadow" />
                          ) : (
                            <ImageIcon className="h-3 w-3 text-white drop-shadow" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px]">{ad.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{ad.seller.store?.name || ad.seller.user.email}</div>
                      {ad.seller.store?.name && (
                        <div className="text-xs">{ad.seller.user.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ad.product ? ad.product.name : ad.service ? ad.service.name : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ad.creativeType}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(ad.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatCurrency(ad.spentAmount)} / {formatCurrency(ad.totalBudget)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ad._count.adClicks}</TableCell>
                    <TableCell className="text-right">
                      {ad.status === "PENDING_APPROVAL" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={loadingId === ad.id}
                            onClick={async () => {
                              setLoadingId(ad.id)
                              await approveAd(ad.id)
                              setLoadingId(null)
                            }}
                          >
                            <Check className="mr-1 h-4 w-4" />
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
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <AdminPagination
            basePath="/admin/seller-ads"
            currentPage={page}
            totalPages={data.totalPages}
            totalCount={data.totalCount}
            pageSize={perPage}
            params={params}
          />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
