"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PricingFields } from "../pricing-fields"

type Category = { id: string; name: string; slug: string }
type Product = {
  id: string
  name: string
  description: string | null
  categoryId: string
  category: { name: string }
  basePrice: number
  discount: number
  hasGst: boolean
  stock: number
  sku: string | null
  images: unknown
  isActive: boolean
}

export function EditProductClient({ productId }: { productId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/product-seller/products/${productId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/categories/list").then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, cats]) => {
      setProduct(p)
      setCategories(cats)
    }).catch(() => setProduct(null)).finally(() => setLoading(false))
  }, [productId])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!product) return
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
    const isActive = (formData.get("isActive") as string) === "true"
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

    setSaving(true)
    const res = await fetch(`/api/product-seller/products/${productId}`, {
      method: "PUT",
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
        isActive,
        images: images.length ? images : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      router.replace("/product-seller/products?success=Product+updated+successfully")
    } else {
      setError(data.error || "Failed to update product")
    }
  }

  if (loading || !product) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">{loading ? "Loading..." : "Product not found."}</p>
      </div>
    )
  }

  const images = Array.isArray(product.images) ? product.images : typeof product.images === "string" ? (() => { try { return JSON.parse(product.images); } catch { return []; } })() : []

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update product information</p>
        </div>
        <Link href="/product-seller/products">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Update the information for your product</CardDescription>
        </CardHeader>
        <CardContent>
          {(error || paramsError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error || (paramsError ? decodeURIComponent(paramsError) : "")}</AlertDescription>
            </Alert>
          )}
          {paramsSuccess && (
            <Alert className="mb-4">
              <AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" name="name" required defaultValue={product.name} placeholder="Enter product name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Product description"
                defaultValue={product.description || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={product.categoryId}
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
              <PricingFields
                defaultBasePrice={product.basePrice}
                defaultDiscount={product.discount ?? 0}
                defaultHasGst={product.hasGst ?? true}
                requireBasePrice={true}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity *</Label>
                <Input id="stock" name="stock" type="number" min={0} required defaultValue={product.stock} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input id="sku" name="sku" defaultValue={product.sku || ""} placeholder="Product SKU" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="images">Image URLs (one per line)</Label>
              <textarea
                id="images"
                name="images"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://example.com/image1.jpg"
                defaultValue={Array.isArray(images) ? images.join("\n") : ""}
              />
              <p className="text-sm text-muted-foreground">Enter image URLs, one per line</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={product.isActive}
                value="true"
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                Active (Product will be visible to customers)
              </Label>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>{saving ? "Updating..." : "Update Product"}</Button>
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
