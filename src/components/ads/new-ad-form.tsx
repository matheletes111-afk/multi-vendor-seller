"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { cn } from "@/lib/utils"
import { Monitor, Smartphone, Megaphone, Info } from "lucide-react"
import { getYoutubeEmbedUrl } from "@/lib/youtube"

type Product = { id: string; name: string }

export type NewAdFormMode = "product-seller" | "customer" | "hotel-seller"

type CreativeState = { type: "IMAGE" | "VIDEO", url: string | null }

export function NewAdForm({
  mode,
  submitUrl,
  backHref,
  listHref,
  successPath,
}: {
  mode: NewAdFormMode
  submitUrl: string
  backHref: string
  listHref: string
  /** Full path including query for success message, e.g. /product-seller/admanagement?success=... */
  successPath: string
}) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adType, setAdType] = useState<"promote_product" | "own_ad">("promote_product")
  const [placements, setPlacements] = useState<string[]>(["WEB", "MOBILE"])
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const searchParams = useSearchParams()

  // Live Preview States
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [webCreative, setWebCreative] = useState<CreativeState>({ type: "IMAGE", url: null })
  const [mobileCreative, setMobileCreative] = useState<CreativeState>({ type: "IMAGE", url: null })

  const isHotelSeller = mode === "hotel-seller"
  const isSeller = mode === "product-seller" || isHotelSeller
  const showProduct = isSeller && adType === "promote_product"
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  // Stable handlers moved to top-level to satisfy Rules of Hooks
  const handleWebCreativeChange = useCallback((c: CreativeState) => {
    setWebCreative(c)
  }, [])

  const handleMobileCreativeChange = useCallback((c: CreativeState) => {
    setMobileCreative(c)
  }, [])

  function togglePlacement(p: string) {
    setPlacements(prev => {
      const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
      return next.length > 0 ? next : prev
    })
  }

  useEffect(() => {
    if (!isSeller) return
    const endpoint = isHotelSeller
      ? "/api/hotel-seller/hotels?page=1&perPage=100"
      : "/api/product-seller/products?page=1&perPage=100"

    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = isHotelSeller ? (json?.hotels ?? []) : (json?.products ?? [])
        setProducts(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
        
        // Check for ID in URL
        const urlId = isHotelSeller ? searchParams.get("hotelId") : searchParams.get("productId")
        if (urlId) {
          setAdType("promote_product")
          setSelectedProductId(urlId)
          
          // Auto-populate title if item exists
          const item = list.find((p: any) => p.id === urlId)
          if (item && !title) {
            setTitle(`Promoting ${item.name}`)
          }
        }
      })
      .catch(() => setProducts([]))
  }, [isSeller, isHotelSeller, searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    if (isSeller) {
      formData.set("adType", adType)
    }

    // Add all selected placements to the formData
    formData.delete("placements") // clear any existing from hidden inputs if needed
    placements.forEach(p => formData.append("placements", p))
    if (showProduct) {
      const fieldName = isHotelSeller ? "hotelId" : "productId"
      const pid = formData.get(fieldName)
      if (!pid || String(pid).trim() === "") {
        setError(`Select a ${isHotelSeller ? "hotel" : "product"} to promote.`)
        return
      }
    } else if (isSeller) {
      formData.delete("productId")
      formData.delete("hotelId")
    }
    setLoading(true)
    const res = await fetch(submitUrl, {
      method: "POST",
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok && data.success) {
      router.replace(successPath)
    } else {
      setError(data.error || "Failed to create ad")
    }
  }

  const titleLine =
    mode === "customer"
      ? "Promote your business with an image or video. You pay only when people click (CPC)."
      : "Choose how you want to advertise, then add creative and budget."

  const cardDesc =
    mode === "customer"
      ? "Own ad: image or video creative, budget, and dates (no product link)."
      : adType === "own_ad"
        ? "Own ad: your creative only — no product selected."
        : "One ad links to one product plus your creative, budget, and dates."

  const renderMockup = (creative: CreativeState, isMobile: boolean) => {
    const isVideo = creative.type === "VIDEO"
    const embedUrl = isVideo && creative.url ? getYoutubeEmbedUrl(creative.url) : null

    return (
      <div className={cn(
        "relative bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800",
        isMobile ? "aspect-[9/16] w-full max-w-[260px] mx-auto" : "aspect-video w-full"
      )}>
        {/* Content */}
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

        {/* Overlay Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-[10px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Sponsored</span>
          </div>
          <h4 className="text-white font-bold text-sm line-clamp-1 drop-shadow-md">
            {title || "Your Ad Title"}
          </h4>
          <p className="text-white/70 text-[10px] line-clamp-2 mt-0.5">
            {description || "Your ad description will appear here. Start typing to see it live."}
          </p>
        </div>

        {/* Device elements for mobile */}
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Create New Ad</h1>
          <p className="text-muted-foreground">{titleLine}</p>
        </div>
        <Link href={backHref}>
          <Button variant="outline" className="rounded-full">
            Back to Ads
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-xl">Campaign Configuration</CardTitle>
              <CardDescription>{cardDesc}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {error && (
                <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-8">
                {isSeller && (
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Ad strategy</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setAdType("promote_product")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                          adType === "promote_product" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="font-bold text-slate-900">Promote a product</span>
                        <span className="text-xs text-slate-500 mt-1">Directly link this ad to one of your existing products.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdType("own_ad")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                          adType === "own_ad" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="font-bold text-slate-900">Own business ad</span>
                        <span className="text-xs text-slate-500 mt-1">General branding for your store — no direct product link.</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Label className="text-base font-semibold">Placements</Label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className={cn(
                      "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                      hasWeb ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    )}>
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
                    <label className={cn(
                      "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                      hasMobile ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    )}>
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
                    <Label htmlFor={isHotelSeller ? "hotelId" : "productId"} className="font-semibold text-slate-700">Linked {isHotelSeller ? "Hotel" : "Product"} *</Label>
                    <select
                      id={isHotelSeller ? "hotelId" : "productId"}
                      name={isHotelSeller ? "hotelId" : "productId"}
                      required
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm transition-focus focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                    >
                      <option value="">Select a {isHotelSeller ? "hotel" : "product"} to link</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {products.length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">You haven't created any {isHotelSeller ? "hotels" : "products"} yet. Go to {isHotelSeller ? "Hotels" : "Products"} to add one.</p>
                    )}
                  </div>
                )}

                <div className="space-y-4 border-t pt-6 mt-6">
                  <Label className="text-base font-semibold">Ad</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-slate-700">Ad title *</Label>
                      <Input
                        id="title"
                        name="title"
                        required
                        placeholder="e.g. 50% Off Summer Collection"
                        className="h-12 rounded-xl"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-slate-700">Ad description (optional)</Label>
                      <textarea
                        id="description"
                        name="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-focus focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm placeholder:text-slate-400"
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
                          label="Main Web Banner (Landscape) *"
                          onCreativeChange={handleWebCreativeChange}
                        />
                      </div>
                    )}

                    {hasMobile && (
                      <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50/30">
                        <AdCreativeField
                          label="Mobile Story Creative (Portrait) *"
                          requiresPortrait
                          fieldNamePrefix="mobile"
                          onCreativeChange={handleMobileCreativeChange}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 border-t pt-6 bg-slate-50 -mx-6 px-6 pb-6 rounded-b-xl">
                  <Label className="text-base font-semibold">Budget & Reach</Label>
                  <BudgetAudienceField />
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startAt" className="text-slate-700">Launch Date *</Label>
                      <Input id="startAt" name="startAt" type="datetime-local" required className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endAt" className="text-slate-700">End Date *</Label>
                      <Input id="endAt" name="endAt" type="datetime-local" required className="h-11 rounded-lg" />
                    </div>
                  </div>
                  <CountryMultiSelect />
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="targetAgeMin">Audience Age (Min)</Label>
                      <Input id="targetAgeMin" name="targetAgeMin" type="number" min={0} max={120} placeholder="18" className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetAgeMax">Audience Age (Max)</Label>
                      <Input id="targetAgeMax" name="targetAgeMax" type="number" min={0} max={120} placeholder="65" className="h-11 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <input type="checkbox" id="expandAudience" name="expandAudience" value="on" className="h-5 w-5 rounded border-slate-300 text-primary" />
                    <div className="space-y-0.5">
                      <Label htmlFor="expandAudience" className="font-bold">Expand target audience</Label>
                      <p className="text-[10px] text-slate-500 leading-tight">Automatically show to broader audience if targeting is too narrow.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <Button type="submit" disabled={loading} size="lg" className="min-w-[160px] rounded-full text-base font-bold shadow-lg shadow-primary/20">
                    {loading ? "Creating..." : "Create & Submit Ad"}
                  </Button>
                  <Link href={listHref}>
                    <Button type="button" variant="ghost" className="rounded-full text-slate-500">
                      Discard
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Preview Column - Sticky */}
        <div className="lg:col-span-5 space-y-8 sticky top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              Live Ad Preview
            </h2>
            <Badge variant="outline" className="bg-white">Simulated View</Badge>
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

            {!hasWeb && !hasMobile && (
              <Card className="border-dashed border-2 bg-slate-50">
                <CardContent className="py-20 text-center">
                  <Megaphone className="h-12 w-12 mx-auto mb-4 text-slate-300 opacity-50" />
                  <p className="text-slate-500 font-medium">Select a placement to see preview</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="bg-blue-600 text-white border-none shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
            <CardContent className="p-6 relative">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                <Info className="h-4 w-4" />
                Ad Guidelines
              </h3>
              <ul className="text-xs space-y-2 text-blue-50/80">
                <li>• Use high-quality images for better engagement.</li>
                <li>• Vertical media (9:16) is required for Mobile Stories.</li>
                <li>• Keep titles short and catchy for mobile users.</li>
                <li>• YouTube Shorts are supported for video ads.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: "outline" | "default", className?: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold",
      variant === "outline" ? "border border-slate-200 text-slate-600" : "bg-primary text-white",
      className
    )}>
      {children}
    </span>
  )
}
