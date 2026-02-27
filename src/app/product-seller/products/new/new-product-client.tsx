"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PricingFields } from "../pricing-fields"
import { Upload, Link as LinkIcon } from "lucide-react"

type Subcategory = { id: string; name: string; slug: string }
type CategoryWithSub = { id: string; name: string; slug: string; subcategories: Subcategory[] }

export function NewProductClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<CategoryWithSub[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageMode, setImageMode] = useState<"link" | "upload">("link")
  const [imageUrlsText, setImageUrlsText] = useState("")
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/categories/list-with-subcategories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const paramsError = searchParams.get("error")
  const subcategories = selectedCategoryId
    ? (categories.find((c) => c.id === selectedCategoryId)?.subcategories ?? [])
    : []

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get("name") as string)?.trim()
    const categoryId = formData.get("categoryId") as string
    const subcategoryId = (formData.get("subcategoryId") as string) || undefined
    const description = (formData.get("description") as string) || undefined
    const basePriceStr = formData.get("basePrice") as string
    const discountStr = (formData.get("discount") as string) || "0"
    const hasGst = (formData.get("hasGst") as string) === "true"
    const stockStr = (formData.get("stock") as string) || "0"
    const sku = (formData.get("sku") as string) || undefined
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

    setLoading(true)
    const res = await fetch("/api/product-seller/products", {
      method: "POST",
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
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value)
                }}
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
                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
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
