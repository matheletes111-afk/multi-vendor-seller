"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
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
import { Megaphone, Check, X, ImageIcon, Video, Eye, MessageSquare } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"

type Ad = {
  id: string
  title: string
  description: string | null
  creativeType: string
  creativeUrl: string
  status: string
  rejectionReason: string | null
  totalBudget: number
  spentAmount: number
  maxCpc: number
  startAt: Date
  endAt: Date
  seller: {
    user: { email: string | null; name: string | null }
    store: { name: string | null } | null
  } | null
  customer: { email: string | null; name: string | null } | null
  product: { id: string; name: string } | null
  service: { id: string; name: string } | null
  _count: { adClicks: number }
}

export function AdminSellerAdsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
    tab: tab === "all" ? undefined : tab,
  }

  const [data, setData] = useState<{
    ads: Ad[]
    totalCount: number
    totalPages: number
    totalRevenue: number
    activeCount: number
    pendingCount: number
    rejectedCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [adToReject, setAdToReject] = useState<string | null>(null)

  const fetchAds = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
      const res = await fetch(`/api/admin/seller-ads?page=${page}&perPage=${perPage}${tabQs}`)
      if (!res.ok) throw new Error("Failed to fetch seller ads")
      const json = await res.json()
      setData(json)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, tab])

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

  const rejectAd = async (adId: string, reason: string) => {
    const res = await fetch(`/api/admin/seller-ads/${adId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || "Failed" }
    await fetchAds()
    router.replace("/admin/seller-ads?success=Rejected")
    return {}
  }

  const adTabs = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "active", label: "Active" },
    { id: "paused", label: "Paused" },
    { id: "rejected", label: "Rejected" },
    { id: "ended", label: "Ended" },
  ] as const

  const statusBadge = (ad: Ad) => {
    if (new Date(ad.endAt) < new Date()) {
      return <Badge variant="secondary" className="font-medium">Ended</Badge>
    }
    switch (ad.status) {
      case "PENDING_APPROVAL":
        return <Badge variant="secondary" className="font-medium">Pending approval</Badge>
      case "ACTIVE":
        return <Badge variant="default" className="font-medium">Active</Badge>
      case "PAUSED":
        return <Badge variant="outline" className="font-medium">Paused</Badge>
      case "ENDED":
        return <Badge variant="secondary" className="font-medium">Ended</Badge>
      case "REJECTED":
        return <Badge variant="destructive" className="font-medium">Rejected</Badge>
      default:
        return <Badge variant="outline" className="font-medium">{ad.status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground"> Ads</h1>
        <p className="text-muted-foreground mt-2 text-sm font-medium">
          Approve or reject ads. Only approved ads show in Sponsored.
        </p>
      </div>

      {params.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription className="font-medium text-xs">{decodeURIComponent(params.success)}</AlertDescription>
        </Alert>
      )}

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-background ring-1 ring-primary/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">Global Revenue</CardDescription>
            <CardTitle className="text-3xl font-medium text-foreground tabular-nums">
              {loading ? "..." : formatCurrency(data?.totalRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Platform ad earnings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-background ring-1 ring-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Active Campaigns</CardDescription>
            <CardTitle className="text-3xl font-medium text-foreground tabular-nums">
              {loading ? "..." : data?.activeCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Currently running ads</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-background ring-1 ring-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Pending Review</CardDescription>
            <CardTitle className="text-3xl font-medium text-foreground tabular-nums">
              {loading ? "..." : data?.pendingCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Awaiting admin action</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden mt-2">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium uppercase tracking-[0.2em]">Ads list</CardTitle>
          </div>
          <CardDescription className="text-xs font-medium text-muted-foreground/60">Manage across-platform campaigns</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading && !data ? (
            <PageLoader message="Loading ads…" />
          ) : fetchError ? (
            <div className="py-12 text-center text-destructive">{fetchError}</div>
          ) : !data ? null : (
            <>
          <div className="flex flex-wrap gap-2 pb-4 mb-4 border-b">
            {adTabs.map((t) => (
              <Link
                key={t.id}
                href={buildAdminPageUrl("/admin/seller-ads", 1, {
                  error: params.error,
                  success: params.success,
                  tab: t.id === "all" ? undefined : t.id,
                })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="rounded-xl border border-muted/50 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Preview</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Title</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Seller</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Context</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Format</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Status</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Allocation / Spend</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4">Performance</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-widest py-4 text-right">Actions</TableHead>
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
                  <TableRow key={ad.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="py-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-2 ring-background shadow-sm transition-transform group-hover:scale-105">
                        {ad.creativeType === "VIDEO" ? (
                          getYoutubeThumbnailUrl(ad.creativeUrl) ? (
                            <img
                              src={getYoutubeThumbnailUrl(ad.creativeUrl)!}
                              alt={ad.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={ad.creativeUrl}
                              className="h-full w-full object-cover"
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
                        <div className="absolute bottom-0.5 right-0.5 rounded-full bg-black/50 p-0.5">
                          {ad.creativeType === "VIDEO" ? (
                            <Video className="h-3 w-3 text-white drop-shadow" />
                          ) : (
                            <ImageIcon className="h-3 w-3 text-white drop-shadow" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm text-foreground max-w-[180px]">{ad.title}</TableCell>
                    <TableCell>
                      {ad.seller ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{ad.seller.store?.name || ad.seller.user.name}</span>
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{ad.seller.user.email}</span>
                        </div>
                      ) : ad.customer ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">Customer</span>
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{ad.customer.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground italic">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs">
                      {ad.product ? ad.product.name : ad.service ? ad.service.name : "Direct Business"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium uppercase text-[9px] tracking-tight bg-muted/5">{ad.creativeType}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(ad)}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground">{formatCurrency(ad.spentAmount)}</span>
                        <span className="text-[10px] text-muted-foreground/60 tracking-wider">OF {formatCurrency(ad.totalBudget)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                       <div className="flex items-center gap-1.5">
                         <Eye className="h-3.5 w-3.5 text-primary/40" />
                         <span className="text-sm tabular-nums">{ad._count.adClicks}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/seller-ads/${ad.id}`}>
                            <Eye className="mr-1 h-3 w-3" />
                            Details
                          </Link>
                        </Button>
                      {ad.status === "PENDING_APPROVAL" && (
                        <>
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
                            onClick={() => {
                              setAdToReject(ad.id)
                              setRejectionReason("")
                              setIsRejectDialogOpen(true)
                            }}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Ad</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejecting this ad. This will be visible to the seller.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  placeholder="Reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={!rejectionReason.trim() || loadingId === adToReject}
                  onClick={async () => {
                    if (!adToReject) return
                    setLoadingId(adToReject)
                    await rejectAd(adToReject, rejectionReason)
                    setLoadingId(null)
                    setIsRejectDialogOpen(false)
                  }}
                >
                  {loadingId === adToReject ? "Rejecting..." : "Reject Ad"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
