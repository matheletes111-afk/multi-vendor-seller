"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { cn } from "@/lib/utils"

type Product = { id: string; name: string }

export type NewAdFormMode = "product-seller" | "customer"

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
  const [placements, setPlacements] = useState<string[]>(["WEB"])

  const isSeller = mode === "product-seller"
  const showProduct = isSeller && adType === "promote_product"
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  function togglePlacement(p: string) {
    setPlacements(prev => {
      const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
      return next.length > 0 ? next : prev
    })
  }

  useEffect(() => {
    if (!isSeller) return
    fetch("/api/product-seller/products?page=1&perPage=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = json?.products ?? []
        setProducts(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      })
      .catch(() => setProducts([]))
  }, [isSeller])

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
      const pid = formData.get("productId")
      if (!pid || String(pid).trim() === "") {
        setError("Select a product to promote.")
        return
      }
    } else if (isSeller) {
      formData.delete("productId")
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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Create Ad</h1>
          <p className="text-muted-foreground">{titleLine}</p>
        </div>
        <Link href={backHref}>
          <Button variant="outline">Back to Ads</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>{cardDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSeller && (
              <div className="space-y-3">
                <Label htmlFor="ad-type-choice">Ad type</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    id="ad-type-choice"
                    onClick={() => setAdType("promote_product")}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                      adType === "promote_product" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="font-medium">Promote a product</span>
                    <span className="text-sm text-muted-foreground">Link the ad to one of your products.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdType("own_ad")}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                      adType === "own_ad" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="font-medium">Own ad</span>
                    <span className="text-sm text-muted-foreground">Image or video for your business — no product link.</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>Placements *</Label>
              <div className="flex gap-4">
                <label className={cn(
                  "flex items-center gap-2 border p-3 rounded-md cursor-pointer transition-colors flex-1",
                  hasWeb ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                )}>
                  <input 
                    type="checkbox" 
                    checked={hasWeb} 
                    onChange={() => togglePlacement("WEB")}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Web Banners</span>
                </label>
                <label className={cn(
                  "flex items-center gap-2 border p-3 rounded-md cursor-pointer transition-colors flex-1",
                  hasMobile ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                )}>
                  <input 
                    type="checkbox" 
                    checked={hasMobile} 
                    onChange={() => togglePlacement("MOBILE")}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Mobile Stories</span>
                </label>
              </div>
              {/* Note: Placements are appended directly to FormData in handleSubmit */}
            </div>

            {showProduct && (
              <div className="space-y-2">
                <Label htmlFor="productId">Product to promote *</Label>
                <select
                  id="productId"
                  name="productId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="text-sm text-muted-foreground">Create a product first from Products.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Ad title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Summer Sale - 20% Off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Short description for the ad"
              />
            </div>
            
            <div className="space-y-6 pt-2">
              {hasWeb && (
                <div className="rounded-lg border p-4 bg-card">
                  <AdCreativeField label="Web Creative (Image or Video) *" />
                </div>
              )}
              
              {hasMobile && (
                <div className="rounded-lg border p-4 bg-card">
                  <AdCreativeField 
                    label="Mobile Creative (Portrait Image or Video) *" 
                    requiresPortrait 
                    fieldNamePrefix="mobile" 
                  />
                </div>
              )}
            </div>

            <BudgetAudienceField />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start date *</Label>
                <Input id="startAt" name="startAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">End date *</Label>
                <Input id="endAt" name="endAt" type="datetime-local" required />
              </div>
            </div>
            <CountryMultiSelect />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetAgeMin">Target age min (optional)</Label>
                <Input id="targetAgeMin" name="targetAgeMin" type="number" min={0} max={120} placeholder="e.g. 18" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAgeMax">Target age max (optional)</Label>
                <Input id="targetAgeMax" name="targetAgeMax" type="number" min={0} max={120} placeholder="e.g. 65" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="expandAudience" name="expandAudience" value="on" className="rounded border-input" />
                <Label htmlFor="expandAudience">Expand audience</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When on: we may show the ad to a broader audience if your target countries have very few users.
              </p>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Ad"}
              </Button>
              <Link href={listHref}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
