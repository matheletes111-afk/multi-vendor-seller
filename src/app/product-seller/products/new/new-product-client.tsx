"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PricingFields } from "../pricing-fields"

type Category = { id: string; name: string; slug: string }

export function NewProductClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/categories/list")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const paramsError = searchParams.get("error")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get("name") as string)?.trim()
    const categoryId = formData.get("categoryId") as string
    const description = (formData.get("description") as string) || undefined
    const basePriceStr = formData.get("basePrice") as string
    const discountStr = (formData.get("discount") as string) || "0"
    const hasGst = (formData.get("hasGst") as string) === "true"
    const stockStr = (formData.get("stock") as string) || "0"
    const sku = (formData.get("sku") as string) || undefined
    const imagesInput = (formData.get("images") as string) || ""
    const images = imagesInput ? imagesInput.split("\n").map((u) => u.trim()).filter(Boolean) : []

    if (!name || !categoryId) {
      setError("Name and category are required")
      return
    }
    const basePrice = parseFloat(basePriceStr)
    const stock = parseInt(stockStr, 10)
    const discount = parseFloat(discountStr) || 0
    if (isNaN(basePrice) || basePrice <= 0) {
      setError("Valid base price is required")
      return
    }
    if (isNaN(stock) || stock < 0) {
      setError("Valid stock is required")
      return
    }

    setLoading(true)
    const res = await fetch("/api/product-seller/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        categoryId,
        basePrice,
        discount,
        hasGst,
        stock,
        sku,
        images: images.length ? images : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok) {
      router.replace("/product-seller/products?success=created")
    } else {
      setError(data.error || "Failed to create product")
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Add New Product</h1>
          <p className="text-muted-foreground">Create a new product listing</p>
        </div>
        <Link href="/product-seller/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Fill in the information for your product</CardDescription>
        </CardHeader>
        <CardContent>
          {(error || paramsError) && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <p className="font-semibold mb-1">Error creating product:</p>
              <p>{error || (paramsError ? decodeURIComponent(paramsError) : "")}</p>
              {(error || paramsError || "").includes("limit") && (
                <Link href="/product-seller/subscription" className="mt-2 inline-block text-sm underline">
                  Upgrade your subscription →
                </Link>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" name="name" required placeholder="Enter product name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Product description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Pricing</Label>
              <PricingFields defaultBasePrice={0} defaultDiscount={0} defaultHasGst={true} requireBasePrice={true} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity *</Label>
                <Input id="stock" name="stock" type="number" min={0} required defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input id="sku" name="sku" placeholder="Product SKU" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="images">Image URLs (one per line)</Label>
              <textarea
                id="images"
                name="images"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://example.com/image1.jpg"
              />
              <p className="text-sm text-muted-foreground">Enter image URLs, one per line</p>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Product"}</Button>
              <Link href="/product-seller/products">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
