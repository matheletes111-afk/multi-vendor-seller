"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PricingFields } from "../pricing-fields"
import { Upload, Link as LinkIcon } from "lucide-react"

type Subcategory = { id: string; name: string; slug: string }
type CategoryWithSub = { id: string; name: string; slug: string; subcategories: Subcategory[] }
type Product = {
  id: string
  name: string
  description: string | null
  categoryId: string
  subcategoryId: string | null
  category: { name: string }
  subcategory?: { id: string; name: string } | null
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
  const [categories, setCategories] = useState<CategoryWithSub[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageMode, setImageMode] = useState<"link" | "upload">("link")
  const [imageUrlsText, setImageUrlsText] = useState("")
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/product-seller/products/${productId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/categories/list-with-subcategories").then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, cats]) => {
      setProduct(p)
      setCategories(cats)
      if (p?.categoryId) setSelectedCategoryId(p.categoryId)
      const imgs = normalizeImages(p?.images)
      setImageUrlsText(Array.isArray(imgs) ? imgs.join("\n") : "")
      setUploadedImageUrls(Array.isArray(imgs) ? imgs : [])
    }).catch(() => setProduct(null)).finally(() => setLoading(false))
  }, [productId])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")
  const subcategories = selectedCategoryId
    ? (categories.find((c) => c.id === selectedCategoryId)?.subcategories ?? [])
    : []

  function normalizeImages(images: unknown): string[] {
    if (Array.isArray(images)) return images
    if (typeof images === "string") {
      try {
        return JSON.parse(images) as string[]
      } catch {
        return []
      }
    }
    return []
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!product) return
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get("name") as string)?.trim()
    const categoryId = formData.get("categoryId") as string
    const subcategoryId = (formData.get("subcategoryId") as string) || null
    const description = (formData.get("description") as string) || undefined
    const basePriceStr = formData.get("basePrice") as string
    const discountStr = (formData.get("discount") as string) || "0"
    const hasGst = (formData.get("hasGst") as string) === "true"
    const stockStr = (formData.get("stock") as string) || "0"
    const sku = (formData.get("sku") as string) || undefined
    const isActive = (formData.get("isActive") as string) === "true"
    const images =
      imageMode === "link"
        ? (imageUrlsText || "").split("\n").map((u) => u.trim()).filter(Boolean)
        : uploadedImageUrls

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
        subcategoryId: subcategoryId || undefined,
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith("image/")) continue
      const fd = new FormData()
      fd.append("file", file)
      try {
        const r = await fetch("/api/product-seller/upload", { method: "POST", body: fd })
        const j = await r.json().catch(() => ({}))
        if (j.url) urls.push(j.url)
      } catch {
        // skip
      }
    }
    setUploadedImageUrls((prev) => [...prev, ...urls])
    setUploading(false)
    e.target.value = ""
  }

  function removeUploadedUrl(url: string) {
    setUploadedImageUrls((prev) => prev.filter((u) => u !== url))
  }

  if (loading || !product) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">{loading ? "Loading..." : "Product not found."}</p>
      </div>
    )
  }

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
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            {subcategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subcategoryId">Subcategory (optional)</Label>
                <select
                  id="subcategoryId"
                  name="subcategoryId"
                  defaultValue={product.subcategoryId ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">None</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            )}
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

            <div className="space-y-3">
              <Label>Images</Label>
              <div className="flex gap-2 p-2 rounded-lg border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setImageMode("link")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${imageMode === "link" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <LinkIcon className="h-4 w-4" />
                  Via link
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${imageMode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <Upload className="h-4 w-4" />
                  File upload
                </button>
              </div>
              {imageMode === "link" ? (
                <>
                  <textarea
                    value={imageUrlsText}
                    onChange={(e) => setImageUrlsText(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="https://example.com/image1.jpg"
                  />
                  <p className="text-sm text-muted-foreground">Enter image URLs, one per line</p>
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Choose images (max 5 MB each)"}
                  </Button>
                  {uploadedImageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {uploadedImageUrls.map((url) => (
                        <div key={url} className="relative w-20 h-20 rounded overflow-hidden border bg-muted">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeUploadedUrl(url)}
                            className="absolute top-0 right-0 bg-destructive/90 text-destructive-foreground text-xs px-1 rounded-bl"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
