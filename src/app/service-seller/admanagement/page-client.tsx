"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
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
import { Plus, Megaphone, Pause, Play, Trash2, ImageIcon, Video } from "lucide-react"

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
  service: { id: string; name: string; slug: string } | null
  _count: { adClicks: number }
}

export function ServiceSellerAdmanagementPageClient() {
  const searchParams = useSearchParams()
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [resumingId, setResumingId] = useState<string | null>(null)

  const fetchAds = () => {
    fetch("/api/service-seller/admanagement")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAds)
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    fetch("/api/service-seller/admanagement")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAds)
      .finally(() => setLoading(false))
  }, [])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  async function pauseAd(adId: string) {
    const res = await fetch(`/api/service-seller/admanagement/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAUSED" }) })
    if (res.ok) fetchAds()
  }
  async function resumeAd(adId: string) {
    const res = await fetch(`/api/service-seller/admanagement/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) })
    if (res.ok) fetchAds()
  }
  async function deleteAdForm(adId: string) {
    const res = await fetch(`/api/service-seller/admanagement/${adId}`, { method: "DELETE" })
    if (res.ok) setAds((prev) => prev.filter((a) => a.id !== adId))
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Management</h1>
          <p className="text-muted-foreground mt-2">Promote your services with sponsored ads (CPC)</p>
        </div>
        <Button asChild>
          <Link href="/service-seller/admanagement/new">
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

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No ads yet</h3>
            <p className="text-muted-foreground mb-6">Create an ad to promote a service. You pay only when customers click.</p>
            <Button asChild>
              <Link href="/service-seller/admanagement/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Ad
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => {
            const videoThumb = ad.creativeType === "VIDEO" ? getYoutubeThumbnailUrl(ad.creativeUrl) : null
            return (
            <Card key={ad.id} className="overflow-hidden">
              <div className="aspect-video relative bg-muted">
                {ad.creativeType === "VIDEO" ? (
                  videoThumb ? (
                    <img src={videoThumb} alt={ad.title} className="w-full h-full object-cover" />
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
                  {ad.service?.name && <span className="block">Service: {ad.service.name}</span>}
                  <span className="block mt-1">Clicks: {ad._count.adClicks} · Spent: {formatCurrency(ad.spentAmount)} / {formatCurrency(ad.totalBudget)}</span>
                  <span className="block text-xs mt-1">Max CPC: {formatCurrency(ad.maxCpc)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {ad.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!pausingId}
                      onClick={async () => {
                        setPausingId(ad.id)
                        await pauseAd(ad.id)
                        setPausingId(null)
                      }}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  {ad.status === "PAUSED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!resumingId}
                      onClick={async () => {
                        setResumingId(ad.id)
                        await resumeAd(ad.id)
                        setResumingId(null)
                      }}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  {ad.status !== "ENDED" && (
                    <DeleteAdButton adId={ad.id} adTitle={ad.title} onDelete={deleteAdForm} />
                  )}
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
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
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Ad</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{adTitle}&quot;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
