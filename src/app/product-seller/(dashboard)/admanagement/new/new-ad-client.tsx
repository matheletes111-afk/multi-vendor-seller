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

type Product = { id: string; name: string }

export function NewAdClient() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/product-seller/products")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setProducts(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => setProducts([]))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    setLoading(true)
    const res = await fetch("/api/product-seller/admanagement", {
      method: "POST",
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok && data.success) {
      router.replace("/product-seller/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval.")
    } else {
      setError(data.error || "Failed to create ad")
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Create Ad</h1>
          <p className="text-muted-foreground">Promote a product. You pay only when customers click (CPC).</p>
        </div>
        <Link href="/product-seller/admanagement">
          <Button variant="outline">Back to Ads</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad details</CardTitle>
          <CardDescription>One ad = one product + one creative (image or video) + budget + dates</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {products.length === 0 && <p className="text-sm text-muted-foreground">Create a product first from Products.</p>}
            </div>
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
            <AdCreativeField />
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
              <p className="text-xs text-muted-foreground">When on: we may show the ad to a broader audience if your target countries have very few users.</p>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Ad"}</Button>
              <Link href="/product-seller/admanagement">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
