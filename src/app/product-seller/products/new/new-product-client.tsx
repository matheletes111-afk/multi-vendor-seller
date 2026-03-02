"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Upload, Link as LinkIcon, Plus, Trash2, Zap } from "lucide-react"

type AttributePair = { key: string; value: string }
type VariantRow = { name: string; price: string; discount: string; hasGst: boolean; stock: string; sku: string; images: string[]; imageMode: "link" | "upload"; attributes: AttributePair[]; details: string }
type GeneratorOption = { optionName: string; valuesText: string }

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
  const [variants, setVariants] = useState<VariantRow[]>([
    { name: "Default", price: "", discount: "0", hasGst: true, stock: "0", sku: "", images: [], imageMode: "link", attributes: [], details: "" },
  ])
  const [variantUploadingFor, setVariantUploadingFor] = useState<number | null>(null)
  const variantFileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [generatorOptions, setGeneratorOptions] = useState<GeneratorOption[]>([])

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

  function addVariant() {
    setVariants((prev) => [...prev, { name: "", price: "", discount: "0", hasGst: true, stock: "0", sku: "", images: [], imageMode: "link", attributes: [], details: "" }])
  }
  function removeVariant(index: number) {
    if (variants.length <= 1) return
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }
  function updateVariant(index: number, field: keyof VariantRow, value: string | boolean | string[] | "link" | "upload" | AttributePair[] | string) {
    setVariants((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addVariantAttribute(variantIndex: number) {
    setVariants((prev) => {
      const next = [...prev]
      const v = next[variantIndex]
      if (v) next[variantIndex] = { ...v, attributes: [...(v.attributes ?? []), { key: "", value: "" }] }
      return next
    })
  }

  function removeVariantAttribute(variantIndex: number, attrIndex: number) {
    setVariants((prev) => {
      const next = [...prev]
      const v = next[variantIndex]
      if (!v?.attributes) return prev
      next[variantIndex] = { ...v, attributes: v.attributes.filter((_, i) => i !== attrIndex) }
      return next
    })
  }

  function updateVariantAttribute(variantIndex: number, attrIndex: number, field: "key" | "value", value: string) {
    setVariants((prev) => {
      const next = [...prev]
      const v = next[variantIndex]
      if (!v?.attributes?.[attrIndex]) return prev
      const attrs = [...v.attributes]
      attrs[attrIndex] = { ...attrs[attrIndex], [field]: value }
      next[variantIndex] = { ...v, attributes: attrs }
      return next
    })
  }

  async function handleVariantFileSelect(e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) {
    const files = e.target.files
    if (!files?.length) return
    setVariantUploadingFor(variantIndex)
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
    if (urls.length > 0) {
      setVariants((prev) => {
        const next = [...prev]
        const v = next[variantIndex]
        if (v) next[variantIndex] = { ...v, images: [...(v.images ?? []), ...urls] }
        return next
      })
    }
    setVariantUploadingFor(null)
    e.target.value = ""
  }

  function removeVariantImage(variantIndex: number, url: string) {
    const v = variants[variantIndex]
    if (!v) return
    updateVariant(variantIndex, "images", (v.images ?? []).filter((u) => u !== url))
  }

  function parseVariantImageLinks(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean)
  }

  function cartesian<T>(arrays: T[][]): T[][] {
    return arrays.reduce((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]] as T[][])
  }

  function generateVariantsFromOptions(optionsList?: GeneratorOption[]) {
    const options = (optionsList ?? generatorOptions).filter((o) => (o.optionName ?? "").trim() && (o.valuesText ?? "").trim())
    if (options.length === 0) return
    const valueArrays = options.map((o) =>
      (o.valuesText ?? "")
        .split(/[,;\n]+/)
        .map((v) => v.trim())
        .filter(Boolean)
    )
    if (valueArrays.some((arr) => arr.length === 0)) return
    const combinations = cartesian(valueArrays) as string[][]
    const newVariants: VariantRow[] = combinations.map((combo) => ({
      name: combo.join(" / "),
      price: "",
      discount: "0",
      hasGst: true,
      stock: "0",
      sku: "",
      images: [],
      imageMode: "link",
      attributes: options.map((opt, idx) => ({ key: (opt.optionName ?? "").trim(), value: combo[idx] ?? "" })),
      details: "",
    }))
    setVariants(newVariants)
  }

  function addGeneratorOption() {
    setGeneratorOptions((prev) => {
      const next = [...prev, { optionName: "", valuesText: "" }]
      generateVariantsFromOptions(next)
      return next
    })
  }
  function removeGeneratorOption(index: number) {
    setGeneratorOptions((prev) => {
      const next = prev.filter((_, i) => i !== index)
      generateVariantsFromOptions(next)
      return next
    })
  }
  function updateGeneratorOption(index: number, field: "optionName" | "valuesText", value: string) {
    setGeneratorOptions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const generatorOptionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generatorOptionsInitialMount = useRef(true)
  useEffect(() => {
    if (generatorOptionsInitialMount.current) {
      generatorOptionsInitialMount.current = false
      return
    }
    if (generatorOptionsDebounceRef.current) clearTimeout(generatorOptionsDebounceRef.current)
    generatorOptionsDebounceRef.current = setTimeout(() => {
      generatorOptionsDebounceRef.current = null
      generateVariantsFromOptions()
    }, 700)
    return () => {
      if (generatorOptionsDebounceRef.current) clearTimeout(generatorOptionsDebounceRef.current)
    }
  }, [generatorOptions])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get("name") as string)?.trim()
    const categoryId = formData.get("categoryId") as string
    const subcategoryId = (formData.get("subcategoryId") as string) || undefined
    const description = (formData.get("description") as string) || undefined
    const images =
      imageMode === "link"
        ? (imageUrlsText || "").split("\n").map((u) => u.trim()).filter(Boolean)
        : uploadedImageUrls

    if (!name || !categoryId) {
      setError("Name and category are required")
      return
    }
    const variantsPayload: { name: string; price: number; discount: number; hasGst: boolean; stock: number; sku?: string; images?: string[]; attributes?: Record<string, string>; details?: string }[] = []
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const price = parseFloat(v.price)
      const stock = parseInt(v.stock, 10)
      const discount = parseFloat(v.discount) || 0
      if (isNaN(price) || price <= 0) {
        setError(`Variant ${i + 1}: valid price is required`)
        return
      }
      if (isNaN(stock) || stock < 0) {
        setError(`Variant ${i + 1}: valid stock is required`)
        return
      }
      const attributesObj =
        Array.isArray(v.attributes) && v.attributes.length > 0
          ? Object.fromEntries(
              v.attributes
                .filter((p) => (p.key ?? "").trim() !== "")
                .map((p) => [(p.key ?? "").trim(), (p.value ?? "").trim()])
            )
          : undefined
      variantsPayload.push({
        name: v.name.trim() || `Variant ${i + 1}`,
        price,
        discount,
        hasGst: v.hasGst,
        stock,
        sku: v.sku.trim() || undefined,
        images: Array.isArray(v.images) && v.images.length > 0 ? v.images : undefined,
        attributes: attributesObj && Object.keys(attributesObj).length > 0 ? attributesObj : undefined,
        details: (v.details ?? "").trim() || undefined,
      })
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
        images: images.length ? images : undefined,
        variants: variantsPayload,
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
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
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
              <p className="text-xs text-muted-foreground">Select a category first to see subcategories</p>
            </div>

            <div className="space-y-3">
              <Label>Product image (listing)</Label>
              <p className="text-xs text-muted-foreground">Main image for this product. Shown on category/browse pages and as fallback on the product page.</p>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Variations *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="h-4 w-4 mr-1" /> Add variation
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">At least one variation (price, stock, SKU per variant)</p>

              <Card className="p-4 border-dashed bg-muted/20">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Generate variants from options</span>
                  </div>
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-md px-2.5 py-1.5 border border-blue-100">
                    Add option name (e.g. Size, Color, Storage) and comma-separated values. One variant is created per combination; variants update automatically when you add, remove or edit options.
                  </p>
                  {generatorOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="Option name (e.g. Size)"
                        value={opt.optionName}
                        onChange={(e) => updateGeneratorOption(idx, "optionName", e.target.value)}
                        className="w-[140px]"
                      />
                      <Input
                        placeholder="Values: M, L, XL"
                        value={opt.valuesText}
                        onChange={(e) => updateGeneratorOption(idx, "valuesText", e.target.value)}
                        className="flex-1 min-w-[160px]"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeGeneratorOption(idx)} className="shrink-0 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={addGeneratorOption}>
                      <Plus className="h-4 w-4 mr-1" /> Add option
                    </Button>
                    <Button type="button" size="sm" onClick={() => generateVariantsFromOptions()}>
                      <Zap className="h-4 w-4 mr-1" /> Generate variants
                    </Button>
                  </div>
                </div>
              </Card>

              {variants.map((v, i) => (
                <Card key={i} className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Variant {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)} disabled={variants.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input placeholder="e.g. Default, Red – M" value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Price *</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label>Discount</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0" value={v.discount} onChange={(e) => updateVariant(i, "discount", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Stock *</Label>
                      <Input type="number" min="0" placeholder="0" value={v.stock} onChange={(e) => updateVariant(i, "stock", e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label>SKU</Label>
                      <Input placeholder="Optional" value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} />
                    </div>
                    <div className="space-y-1 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={v.hasGst} onChange={(e) => updateVariant(i, "hasGst", e.target.checked)} className="h-4 w-4 rounded border-input" />
                        <span className="text-sm">Has GST</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Variant images (optional)</Label>
                    <p className="text-xs text-muted-foreground">Shown on product page when this variant is selected.</p>
                    <div className="flex gap-2 p-2 rounded-lg border bg-muted/30">
                      <button
                        type="button"
                        onClick={() => updateVariant(i, "imageMode", "link")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${v.imageMode === "link" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Via link
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVariant(i, "imageMode", "upload")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${v.imageMode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        <Upload className="h-4 w-4" />
                        File upload
                      </button>
                    </div>
                    {v.imageMode === "link" ? (
                      <>
                        <textarea
                          className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                          value={Array.isArray(v.images) ? v.images.join(", ") : ""}
                          onChange={(e) => updateVariant(i, "images", parseVariantImageLinks(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Enter URLs separated by comma or new line.</p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <input
                          ref={(el) => { variantFileInputRefs.current[i] = el }}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => handleVariantFileSelect(e, i)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => variantFileInputRefs.current[i]?.click()}
                          disabled={variantUploadingFor === i}
                        >
                          {variantUploadingFor === i ? "Uploading..." : "Choose images (multi select)"}
                        </Button>
                        {(v.images?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {v.images.map((url) => (
                              <div key={url} className="relative w-20 h-20 rounded overflow-hidden border bg-muted">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeVariantImage(i, url)}
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
                  <div className="space-y-2">
                    <Label>Attributes (key-value)</Label>
                    <p className="text-xs text-muted-foreground">e.g. Size: M, Color: Red. Used for variant selection on product page.</p>
                    {(v.attributes ?? []).map((attr, attrIdx) => (
                      <div key={attrIdx} className="flex gap-2 items-center">
                        <Input
                          placeholder="Key (e.g. Size)"
                          value={attr.key}
                          onChange={(e) => updateVariantAttribute(i, attrIdx, "key", e.target.value)}
                          className="flex-1 max-w-[140px]"
                        />
                        <Input
                          placeholder="Value (e.g. M)"
                          value={attr.value}
                          onChange={(e) => updateVariantAttribute(i, attrIdx, "value", e.target.value)}
                          className="flex-1 max-w-[140px]"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeVariantAttribute(i, attrIdx)} className="shrink-0 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addVariantAttribute(i)}>
                      <Plus className="h-4 w-4 mr-1" /> Add attribute
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Details (optional)</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Variant-specific details or description"
                      value={v.details ?? ""}
                      onChange={(e) => updateVariant(i, "details", e.target.value)}
                    />
                  </div>
                </Card>
              ))}
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
