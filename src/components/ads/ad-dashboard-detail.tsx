"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ArrowLeft, Megaphone, Target, Clock, BarChart3, Presentation, Smartphone, Monitor, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeEmbedUrl } from "@/lib/youtube"
import { PageLoader } from "@/components/ui/page-loader"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"

type DashboardAd = {
  id: string
  title: string
  description: string | null
  creativeType: "IMAGE" | "VIDEO"
  creativeUrl: string
  placements: string[] | null
  mobileCreativeType: "IMAGE" | "VIDEO" | null
  mobileCreativeUrl: string | null
  status: string
  totalBudget: number
  spentAmount: number
  maxCpc: number
  startAt: string
  endAt: string
  targetCountries: string[] | null
  _count: { adClicks: number }
  product?: { id: string; name: string } | null
  service?: { id: string; name: string } | null
}

export function AdDashboardDetail({
  adId,
  apiBaseUrl,
  backHref,
}: {
  adId: string
  apiBaseUrl: string
  backHref: string
}) {
  const router = useRouter()
  const [ad, setAd] = useState<DashboardAd | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDeleteAd = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`${apiBaseUrl}/${adId}`, { method: "DELETE" })
      if (res.ok) {
        router.replace(`${backHref}?success=Ad+deleted+successfully`)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to delete ad")
      }
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${apiBaseUrl}/${adId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((data: DashboardAd) => {
        if (!cancelled) setAd(data)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adId, apiBaseUrl])

  if (loading) return <PageLoader message="Loading ad details…" />

  if (notFound || !ad) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Button variant="ghost" asChild className="-ml-4 mb-4">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Ads
          </Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="text-lg font-semibold mb-2">Ad not found</h3>
            <p className="text-muted-foreground">The ad you are looking for does not exist or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return <Badge variant="secondary">Pending approval</Badge>
      case "ACTIVE":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>
      case "PAUSED":
        return <Badge variant="outline">Paused</Badge>
      case "ENDED":
        return <Badge variant="secondary">Ended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderCreative = (type: string | null, url: string | null, label: string, isMobile: boolean) => {
    if (!url || !type) return null
    const isVideo = type === "VIDEO"
    const embedUrl = isVideo ? getYoutubeEmbedUrl(url) : null

    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4 border-b">
          <div className="flex items-center gap-2">
            {isMobile ? <Smartphone className="h-5 w-5 text-muted-foreground" /> : <Monitor className="h-5 w-5 text-muted-foreground" />}
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
        </CardHeader>
        <div className={`bg-black/5 flex items-center justify-center p-4 ${isMobile ? "aspect-[9/16] max-h-[500px]" : "aspect-video"}`}>
          <div className={`relative overflow-hidden rounded-md shadow-sm w-full h-full ${isMobile ? "max-w-[280px] mx-auto" : "max-w-full"}`}>
            {isVideo ? (
              embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={`${label} video`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={url} controls className="w-full h-full object-contain bg-black" />
              )
            ) : (
              <img src={url} alt={label} className="w-full h-full object-contain" />
            )}
          </div>
        </div>
      </Card>
    )
  }

  const placementsList = ad.placements && ad.placements.length > 0 ? ad.placements : ["WEB"]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{ad.title}</h1>
              {statusBadge(ad.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {ad.product?.name ? `Promoting Product: ${ad.product.name}` : ad.service?.name ? `Promoting Service: ${ad.service.name}` : "Own Business Ad"}
            </p>
          </div>
        </div>

        <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Ad
        </Button>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ad</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{ad.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAd} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metrics and Metadata */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Total Clicks</span>
                <span className="font-semibold">{ad._count?.adClicks || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Spent / Budget</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(ad.spentAmount)} <span className="text-muted-foreground font-normal">/ {formatCurrency(ad.totalBudget)}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Max CPC</span>
                <span className="font-semibold">{formatCurrency(ad.maxCpc)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Schedule & Targeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">Start</span>
                <span className="text-sm font-medium">{new Date(ad.startAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">End</span>
                <span className="text-sm font-medium">{new Date(ad.endAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground block mb-2">Target Countries</span>
                <div className="flex flex-wrap gap-1">
                  {ad.targetCountries && ad.targetCountries.length > 0 ? (
                    ad.targetCountries.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)
                  ) : (
                    <Badge variant="outline" className="text-xs">Global (All)</Badge>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <span className="text-sm text-muted-foreground block mb-2">Active Placements</span>
                <div className="flex flex-wrap gap-1">
                  {placementsList.map(p => (
                    <Badge key={p} variant="default" className="text-xs capitalize">{p.toLowerCase()}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {ad.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ad.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Creatives */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Presentation className="h-6 w-6 text-primary" />
            Ad Creatives
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {placementsList.includes("WEB") && (
              renderCreative(ad.creativeType, ad.creativeUrl, "Web Banner", false)
            )}
            {placementsList.includes("MOBILE") && (
              renderCreative(ad.mobileCreativeType, ad.mobileCreativeUrl, "Mobile Story", true)
            )}
            {!placementsList.includes("MOBILE") && placementsList.includes("WEB") && (
              <div className="hidden lg:flex items-center justify-center p-8 border border-dashed rounded-lg bg-muted/20 text-center h-full min-h-[300px]">
                <div>
                  <Smartphone className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground text-sm font-medium mb-1">Mobile placement not enabled</p>
                  <p className="text-xs text-muted-foreground/70">Enable mobile placements to reach users on stories.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
