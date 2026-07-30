"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { PageLoader } from "@/components/ui/page-loader"
import { cn } from "@/lib/utils"
import { Monitor, Smartphone, Megaphone, Info, AlertTriangle, ArrowLeft } from "lucide-react"
import { getYoutubeEmbedUrl } from "@/lib/youtube"

type Product = { id: string; name: string }

export type EditAdFormMode = "product-seller" | "hotel-seller" | "restaurant-seller" | "service-seller"

type CreativeState = { type: "IMAGE" | "VIDEO"; url: string | null }

export function EditAdForm({
  mode,
  adId,
  apiBaseUrl,
  backHref,
}: {
  mode: EditAdFormMode
  adId: string
  apiBaseUrl: string
  backHref: string
}) {
  const router = useRouter()
  const [initialLoading, setInitialLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [adType, setAdType] = useState<"promote_product" | "own_ad">("promote_product")
  const [placements, setPlacements] = useState<string[]>(["WEB", "MOBILE"])
  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  
  const [totalBudget, setTotalBudget] = useState<number | string>("")
  const [maxCpc, setMaxCpc] = useState<number | string>("")
  const [startAt, setStartAt] = useState<string>("")
  const [endAt, setEndAt] = useState<string>("")
  const [targetCountries, setTargetCountries] = useState<string[]>([])
  const [targetAgeMin, setTargetAgeMin] = useState<number | string>("")
  const [targetAgeMax, setTargetAgeMax] = useState<number | string>("")
  const [targetAudience, setTargetAudience] = useState<number | string>("")
  const [expandAudience, setExpandAudience] = useState<boolean>(false)

  const [webCreative, setWebCreative] = useState<CreativeState>({ type: "IMAGE", url: null })
  const [mobileCreative, setMobileCreative] = useState<CreativeState>({ type: "IMAGE", url: null })

  const isHotelSeller = mode === "hotel-seller"
  const isRestaurantSeller = mode === "restaurant-seller"
  const isServiceSeller = mode === "service-seller"
  const isProductSeller = mode === "product-seller"

  const showProduct = adType === "promote_product"
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  const itemLabel = isHotelSeller
    ? "Hotel"
    : isRestaurantSeller
    ? "Food Item"
    : isServiceSeller
    ? "Service"
    : "Product"

  const handleWebCreativeChange = useCallback((c: CreativeState) => {
    setWebCreative(c)
  }, [])

  const handleMobileCreativeChange = useCallback((c: CreativeState) => {
    setMobileCreative(c)
  }, [])

  function togglePlacement(p: string) {
    setPlacements((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
      return next.length > 0 ? next : prev
    })
  }

  // Fetch available items to link
  useEffect(() => {
    let endpoint = "/api/product-seller/products?page=1&perPage=100"
    if (isHotelSeller) {
      endpoint = "/api/hotel-seller/hotels?page=1&perPage=100"
    } else if (isRestaurantSeller) {
      endpoint = "/api/restaurant-seller/foods"
    } else if (isServiceSeller) {
      endpoint = "/api/service-seller/services"
    }

    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        let list = []
        if (isHotelSeller) {
          list = json?.hotels ?? []
        } else if (isRestaurantSeller) {
          list = json?.data ?? []
        } else if (isServiceSeller) {
          list = json?.services ?? json?.data ?? []
        } else {
          list = json?.products ?? []
        }
        setProducts(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      })
      .catch(() => setProducts([]))
  }, [isHotelSeller, isRestaurantSeller, isServiceSeller])

  // Fetch existing ad details
  useEffect(() => {
    setInitialLoading(true)
    fetch(`${apiBaseUrl}/${adId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load ad")))
      .then((ad) => {
        const adData = ad.data ?? ad
        setTitle(adData.title || "")
        setDescription(adData.description || "")
        
        const linkedId = adData.productId || adData.foodItemId || adData.hotelId || adData.serviceId || adData.foodItem?.id || adData.product?.id || adData.hotel?.id || adData.service?.id
        if (linkedId) {
          setAdType("promote_product")
          setSelectedItemId(linkedId)
        } else {
          setAdType("own_ad")
        }

        if (Array.isArray(adData.placements) && adData.placements.length > 0) {
          setPlacements(adData.placements)
        }

        setWebCreative({
          type: adData.creativeType === "VIDEO" ? "VIDEO" : "IMAGE",
          url: adData.creativeUrl || null,
        })
        setMobileCreative({
          type: adData.mobileCreativeType === "VIDEO" ? "VIDEO" : "IMAGE",
          url: adData.mobileCreativeUrl || adData.creativeUrl || null,
        })

        setTotalBudget(adData.totalBudget ?? "")
        setMaxCpc(adData.maxCpc ?? "")

        if (adData.startAt) {
          const d = new Date(adData.startAt)
          setStartAt(d.toISOString().slice(0, 16))
        }
        if (adData.endAt) {
          const d = new Date(adData.endAt)
          setEndAt(d.toISOString().slice(0, 16))
        }

        if (Array.isArray(adData.targetCountries)) {
          setTargetCountries(adData.targetCountries)
        }

        setTargetAgeMin(adData.targetAgeMin ?? "")
        setTargetAgeMax(adData.targetAgeMax ?? "")
        setTargetAudience(adData.targetAudience ?? "")
        setExpandAudience(Boolean(adData.expandAudience))
      })
      .catch((err) => {
        setError(typeof err === "string" ? err : "Failed to fetch ad details")
      })
      .finally(() => setInitialLoading(false))
  }, [adId, apiBaseUrl])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set("adType", adType)
    formData.delete("placements")
    placements.forEach((p) => formData.append("placements", p))

    if (showProduct) {
      const fieldName = isHotelSeller
        ? "hotelId"
        : isRestaurantSeller
        ? "foodItemId"
        : isServiceSeller
        ? "serviceId"
        : "productId"
      formData.set(fieldName, selectedItemId)
      if (!selectedItemId) {
        setError(`Please select a ${itemLabel} to promote.`)
        return
      }
    } else {
      formData.delete("productId")
      formData.delete("hotelId")
      formData.delete("foodItemId")
      formData.delete("serviceId")
    }

    setLoading(true)
    const res = await fetch(`${apiBaseUrl}/${adId}`, {
      method: "PATCH",
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok && (data.success !== false)) {
      router.replace(`${backHref}?success=Ad+updated+successfully.`)
    } else {
      setError(data.error || "Failed to update ad")
    }
  }

  const renderMockup = (creative: CreativeState, isMobile: boolean) => {
    const isVideo = creative.type === "VIDEO"
    const embedUrl = isVideo && creative.url ? getYoutubeEmbedUrl(creative.url) : null

    return (
      <div
        className={cn(
          "relative bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800",
          isMobile ? "aspect-[9/16] w-full max-w-[260px] mx-auto" : "aspect-video w-full"
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          {creative.url ? (
            isVideo ? (
              embedUrl ? (
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
              ) : (
                <video src={creative.url} className="w-full h-full object-cover" autoPlay muted loop />
              )
            ) : (
              <img src={creative.url} className="w-full h-full object-cover" alt="Preview" />
            )
          ) : (
            <div className="flex flex-col items-center text-slate-500 p-4 text-center">
              <Megaphone className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-xs">No {creative.type.toLowerCase()} selected</p>
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-[10px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Sponsored
            </span>
          </div>
          <h4 className="text-white font-bold text-sm line-clamp-1 drop-shadow-md">
            {title || "Your Ad Title"}
          </h4>
          <p className="text-white/70 text-[10px] line-clamp-2 mt-0.5">
            {description || "Your ad description will appear here."}
          </p>
        </div>

        {isMobile && (
          <>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full" />
            <div className="absolute top-3 right-4 flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
          </>
        )}
      </div>
    )
  }

  if (initialLoading) {
    return <PageLoader message="Loading ad for editing…" />
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Ad</h1>
          <p className="text-muted-foreground">Update your ad title, creative media, budget, and targeting settings.</p>
        </div>
        <Link href={backHref}>
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Ads
          </Button>
        </Link>
      </div>

      {/* Seller Note Banner */}
      <Alert className="bg-amber-50 border-amber-200 text-amber-900 rounded-xl shadow-sm">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <AlertTitle className="font-bold text-amber-950 text-sm">Ad Re-approval Workflow Notice</AlertTitle>
          <AlertDescription className="text-xs text-amber-850 mt-1 leading-relaxed">
            When a seller edits an active or rejected ad (e.g., changes title, creative image/video, or placements), the ad status will be reset to <strong>PENDING_APPROVAL</strong> so that administrators can review the updated content before it goes live again. If only budget/date ranges are edited, or if preferred, we can configure whether re-approval is required.
          </AlertDescription>
        </div>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-xl">Ad Configuration</CardTitle>
              <CardDescription>Modify your ad details below and submit for save.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {error && (
                <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Ad strategy</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAdType("promote_product")}
                      className={cn(
                        "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                        adType === "promote_product"
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="font-bold text-slate-900">Promote a {itemLabel.toLowerCase()}</span>
                      <span className="text-xs text-slate-500 mt-1">Directly link this ad to one of your existing items.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdType("own_ad")}
                      className={cn(
                        "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                        adType === "own_ad"
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="font-bold text-slate-900">Own business ad</span>
                      <span className="text-xs text-slate-500 mt-1">General branding for your store — no direct item link.</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-semibold">Placements</Label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label
                      className={cn(
                        "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                        hasWeb
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={hasWeb}
                        onChange={() => togglePlacement("WEB")}
                        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-slate-500" />
                        <span className="font-bold text-slate-900">Web Banners</span>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                        hasMobile
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={hasMobile}
                        onChange={() => togglePlacement("MOBILE")}
                        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-slate-500" />
                        <span className="font-bold text-slate-900">Mobile Stories</span>
                      </div>
                    </label>
                  </div>
                </div>

                {showProduct && (
                  <div className="space-y-3">
                    <Label htmlFor="linkedItemId" className="font-semibold text-slate-700">
                      Linked {itemLabel} *
                    </Label>
                    <select
                      id="linkedItemId"
                      required
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                    >
                      <option value="">Select a {itemLabel.toLowerCase()} to link</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-4 border-t pt-6 mt-6">
                  <Label className="text-base font-semibold">Ad Info</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-slate-700">
                        Ad title *
                      </Label>
                      <Input
                        id="title"
                        name="title"
                        required
                        placeholder="e.g. Special Offer"
                        className="h-12 rounded-xl"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-slate-700">
                        Ad description (optional)
                      </Label>
                      <textarea
                        id="description"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                        placeholder="Engaging description for your audience..."
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t mt-6">
                  <Label className="text-base font-semibold">Creatives</Label>
                  <div className="grid gap-6">
                    {hasWeb && (
                      <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50/30">
                        <AdCreativeField
                          label="Main Web Banner (Landscape)"
                          initialType={webCreative.type}
                          initialUrl={webCreative.url}
                          onCreativeChange={handleWebCreativeChange}
                        />
                      </div>
                    )}

                    {hasMobile && (
                      <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50/30">
                        <AdCreativeField
                          label="Mobile Story Creative (Portrait)"
                          requiresPortrait
                          fieldNamePrefix="mobile"
                          initialType={mobileCreative.type}
                          initialUrl={mobileCreative.url}
                          onCreativeChange={handleMobileCreativeChange}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 border-t pt-6 bg-slate-50 -mx-6 px-6 pb-6 rounded-b-xl">
                  <Label className="text-base font-semibold">Budget & Reach</Label>
                  <BudgetAudienceField defaultTotalBudget={totalBudget} defaultMaxCpc={maxCpc} />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startAt" className="text-slate-700">
                        Launch Date *
                      </Label>
                      <Input
                        id="startAt"
                        name="startAt"
                        type="datetime-local"
                        required
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endAt" className="text-slate-700">
                        End Date *
                      </Label>
                      <Input
                        id="endAt"
                        name="endAt"
                        type="datetime-local"
                        required
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                  </div>

                  <CountryMultiSelect defaultCountries={targetCountries} />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="targetAgeMin">Audience Age (Min)</Label>
                      <Input
                        id="targetAgeMin"
                        name="targetAgeMin"
                        type="number"
                        min={0}
                        max={120}
                        value={targetAgeMin}
                        onChange={(e) => setTargetAgeMin(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetAgeMax">Audience Age (Max)</Label>
                      <Input
                        id="targetAgeMax"
                        name="targetAgeMax"
                        type="number"
                        min={0}
                        max={120}
                        value={targetAgeMax}
                        onChange={(e) => setTargetAgeMax(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <input
                      type="checkbox"
                      id="expandAudience"
                      name="expandAudience"
                      value="on"
                      checked={expandAudience}
                      onChange={(e) => setExpandAudience(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-primary"
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="expandAudience" className="font-bold">
                        Expand target audience
                      </Label>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Automatically show to broader audience if targeting is too narrow.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="min-w-[160px] rounded-full text-base font-bold shadow-lg shadow-primary/20"
                  >
                    {loading ? "Saving Changes..." : "Save & Submit Ad"}
                  </Button>
                  <Link href={backHref}>
                    <Button type="button" variant="ghost" className="rounded-full text-slate-500">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-8 sticky top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">Live Ad Preview</h2>
          </div>

          <div className="space-y-8">
            {hasMobile && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">
                  <Smartphone className="h-4 w-4" />
                  Mobile Story
                </div>
                {renderMockup(mobileCreative, true)}
              </div>
            )}

            {hasWeb && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">
                  <Monitor className="h-4 w-4" />
                  Web Banner
                </div>
                {renderMockup(webCreative, false)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
