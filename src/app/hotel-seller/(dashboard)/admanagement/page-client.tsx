"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeThumbnailUrl } from "@/lib/youtube"
import { PageLoader } from "@/components/ui/page-loader"
import { Plus, Megaphone, Pause, Play, Trash2, ImageIcon, Video, Eye } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type Ad = {
  id: string
  title: string
  description: string | null
  creativeType: "IMAGE" | "VIDEO"
  creativeUrl: string
  status: string
  totalBudget: number
  spentAmount: number
  maxCpc: number
  startAt: string
  endAt: string
  hotel: { id: string; name: string } | null
  rejectionReason: string | null
  _count: { adClicks: number }
}

export function HotelSellerAdmanagementPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const paginationParams = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

  const [ads, setAds] = useState<Ad[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [resumingId, setResumingId] = useState<string | null>(null)

  const fetchAds = useCallback(() => {
    setLoading(true)
    return fetch(`/api/hotel-seller/admanagement?page=${page}&perPage=${perPage}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.ads) {
          setAds(json.ads)
          setTotalCount(json.totalCount ?? 0)
          setTotalPages(json.totalPages ?? 1)
        } else {
          setAds([])
          setTotalCount(0)
          setTotalPages(1)
        }
      })
      .finally(() => setLoading(false))
  }, [page, perPage])

  useEffect(() => {
    fetchAds()
  }, [fetchAds])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  async function pauseAd(adId: string) {
    const res = await fetch(`/api/hotel-seller/admanagement/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAUSED" }) })
    if (res.ok) fetchAds()
  }
  async function resumeAd(adId: string) {
    const res = await fetch(`/api/hotel-seller/admanagement/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) })
    if (res.ok) fetchAds()
  }
  async function deleteAdForm(adId: string) {
    const res = await fetch(`/api/hotel-seller/admanagement/${adId}`, { method: "DELETE" })
    if (res.ok) {
      const wasLastOnPage = ads.length === 1
      if (wasLastOnPage && page > 1) {
        router.replace(`/hotel-seller/admanagement?page=${page - 1}`)
        return
      }
      fetchAds()
    }
  }

  const statusBadge = (ad: Ad) => {
    if (new Date(ad.endAt) < new Date()) {
      return <Badge variant="secondary">Ended</Badge>
    }
    switch (ad.status) {
      case "PENDING_APPROVAL":
        return <Badge variant="secondary">Pending approval</Badge>
      case "ACTIVE":
        return <Badge variant="default">Active</Badge>
      case "PAUSED":
        return <Badge variant="outline">Paused</Badge>
      case "ENDED":
        return <Badge variant="secondary">Ended</Badge>
      case "REJECTED":
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="destructive">Rejected</Badge>
            {ad.rejectionReason && (
              <p className="text-[10px] text-destructive font-medium max-w-[150px] leading-tight italic">
                Reason: {ad.rejectionReason}
              </p>
            )}
          </div>
        )
      default:
        return <Badge variant="outline">{ad.status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Management</h1>
          <p className="text-muted-foreground mt-2">Promote a hotel property or run your own image/video ad (CPC)</p>
        </div>
        <Button asChild className="rounded-xl shadow-lg">
          <Link href="/hotel-seller/admanagement/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Ad
          </Link>
        </Button>
      </div>

      {paramsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsError)}</AlertDescription>
        </Alert>
      )}
      {paramsSuccess && (
        <Alert className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription>
        </Alert>
      )}

      {loading && ads.length === 0 ? (
        <PageLoader message="Loading ads…" />
      ) : ads.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No ads yet</h3>
            <p className="text-muted-foreground mb-6">Create an ad for a hotel or for your business. You pay only when customers click.</p>
            <Button asChild className="rounded-xl">
              <Link href="/hotel-seller/admanagement/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Ad
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-none shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[88px]">Creative</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Hotel / own ad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Duration</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Spent / Budget</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Clicks</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Max CPC</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => {
                  const videoThumb = ad.creativeType === "VIDEO" ? getYoutubeThumbnailUrl(ad.creativeUrl) : null
                  const isEnded = ad.status === "ENDED" || new Date(ad.endAt) < new Date()
                  
                  return (
                    <TableRow key={ad.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="align-middle">
                        <div className="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                          {ad.creativeType === "VIDEO" ? (
                            videoThumb ? (
                              <img src={videoThumb} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <video src={ad.creativeUrl} className="w-full h-full object-cover" muted preload="metadata" playsInline />
                            )
                          ) : (
                            <Image src={ad.creativeUrl} alt="" fill className="object-cover" unoptimized />
                          )}
                          <span className="absolute top-0.5 right-0.5">
                            {ad.creativeType === "VIDEO" ? <Video className="h-3 w-3 text-white drop-shadow" /> : <ImageIcon className="h-3 w-3 text-white drop-shadow" />}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <span className="line-clamp-2">{ad.title}</span>
                        <p className="text-xs text-muted-foreground md:hidden mt-0.5 line-clamp-1">
                          {ad.hotel?.name ?? "Own business ad"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {ad.hotel?.name ?? "Own business ad"}
                      </TableCell>
                      <TableCell>{statusBadge(ad)}</TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ad.startAt).toLocaleDateString()} - {new Date(ad.endAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm whitespace-nowrap">
                        {formatCurrency(ad.spentAmount)} / {formatCurrency(ad.totalBudget)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right">{ad._count.adClicks}</TableCell>
                      <TableCell className="hidden xl:table-cell text-right text-sm whitespace-nowrap">{formatCurrency(ad.maxCpc)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!isEnded && ad.status === "ACTIVE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={!!pausingId}
                              onClick={async () => {
                                setPausingId(ad.id)
                                await pauseAd(ad.id)
                                setPausingId(null)
                              }}
                            >
                              <Pause className="mr-1 h-3 w-3" />
                              Pause
                            </Button>
                          )}
                          {!isEnded && ad.status === "PAUSED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={!!resumingId}
                              onClick={async () => {
                                setResumingId(ad.id)
                                await resumeAd(ad.id)
                                setResumingId(null)
                              }}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              Resume
                            </Button>
                          )}
                          {!isEnded && (
                            <DeleteAdButton adId={ad.id} adTitle={ad.title} onDelete={deleteAdForm} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/hotel-seller/admanagement"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={paginationParams}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

function DeleteAdButton({ adId, adTitle, onDelete }: { adId: string; adTitle: string; onDelete: (adId: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  async function handleDelete() {
    setIsDeleting(true)
    await onDelete(adId)
    setOpen(false)
    setIsDeleting(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="rounded-xl shadow-lg">
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Delete Ad</DialogTitle>
          <DialogDescription>Are you sure you want to delete &quot;{adTitle}&quot;? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" className="rounded-xl" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
