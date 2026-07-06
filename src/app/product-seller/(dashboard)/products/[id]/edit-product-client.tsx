"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { Upload, Link as LinkIcon, Plus, Trash2, Zap } from "lucide-react"

type AttributePair = { key: string; value: string }
type VariantRow = {
  name: string
  price: string
  discount: string
  hasGst: boolean
  stock: string
  sku: string
  images: string[]
  imageMode: "link" | "upload"
  attributes: AttributePair[]
  details: string
  returnType: "NON_RETURNABLE" | "RETURNABLE"
  returnDays: string
  replacementAllowed: boolean
}
type GeneratorOption = { optionName: string; valuesText: string }

type Subcategory = { id: string; name: string; slug: string }
type CategoryWithSub = { id: string; name: string; slug: string; subcategories: Subcategory[] }
type Variant = {
  id: string
  name: string
  price: number
  discount: number
  hasGst: boolean
  stock: number
  sku: string | null
  images?: unknown
  attributes?: unknown
  details?: string | null
  additionalInfo?: unknown
  returnType?: string
  returnDays?: number | null
  replacementAllowed?: boolean
}
type Product = {
  id: string
  name: string
  description: string | null
  categoryId: string
  subcategoryId: string | null
  category: { name: string }
  subcategory?: { id: string; name: string } | null
  images: unknown
  isActive: boolean
  condition: "NEW" | "USED"
  deliveryChargePerKm: number
  variants: Variant[]
}

export function EditProductClient({ productId }: { productId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<CategoryWithSub[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [condition, setCondition] = useState<"NEW" | "USED">("NEW")
  const [error, setError] = useState<string | null>(null)
  const [masterImageMode, setMasterImageMode] = useState<"link" | "upload">("upload")
  const [masterImageUrl, setMasterImageUrl] = useState("")
  const [masterImageFile, setMasterImageFile] = useState<File | null>(null)
  const [masterImagePreviewUrl, setMasterImagePreviewUrl] = useState("")
  const masterImagePreviewUrlRef = useRef("")
  const [uploading, setUploading] = useState(false)
  const masterFileInputRef = useRef<HTMLInputElement>(null)
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [variantUploadingFor, setVariantUploadingFor] = useState<number | null>(null)
  const variantFileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [variantPendingFiles, setVariantPendingFiles] = useState<File[][]>([])
  const variantPreviewUrlsRef = useRef<string[][]>([])
  const [generatorOptions, setGeneratorOptions] = useState<GeneratorOption[]>([{ optionName: "Size", valuesText: "M, L, XL" }, { optionName: "Color", valuesText: "Red, Blue" }])

  useEffect(() => {
    Promise.all([
      fetch(`/api/product-seller/products/${productId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-seller/categories").then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, cats]) => {
      setProduct(p)
      setCategories(cats)
      if (p?.categoryId) setSelectedCategoryId(p.categoryId)
      if (p?.condition) setCondition(p.condition)
      const imgs = normalizeImages(p?.images)
      setMasterImageUrl(Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : "")
      setMasterImageFile(null)
      setMasterImagePreviewUrl("")
      masterImagePreviewUrlRef.current = ""
      const v = (p as Product)?.variants ?? []
      setVariants(
        v.length > 0
          ? v.map((x) => {
              const attrs = x.attributes && typeof x.attributes === "object" && !Array.isArray(x.attributes)
                ? Object.entries(x.attributes as Record<string, string>).map(([key, value]) => ({ key, value: value ?? "" }))
                : []
            const addInfo =
              x.additionalInfo && typeof x.additionalInfo === "object" && !Array.isArray(x.additionalInfo)
                ? (x.additionalInfo as any)
                : {}
            const rp = addInfo?.returnPolicy ?? { type: "NON_RETURNABLE" }
              const dbRt = x.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
              const rt = dbRt === "RETURNABLE" ? "RETURNABLE" : rp.type === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
              const days =
                x.returnDays != null && x.returnDays > 0
                  ? String(x.returnDays)
                  : rp.days
                    ? String(rp.days)
                    : ""
              return {
                name: x.name,
                price: String(x.price),
                discount: String(x.discount ?? 0),
                hasGst: x.hasGst ?? true,
                stock: String(x.stock),
                sku: x.sku ?? "",
                images: Array.isArray(x.images) ? (x.images as string[]) : [],
                imageMode: "upload" as const,
                attributes: attrs,
              details: typeof x.details === "string" ? x.details : "",
              returnType: rt,
              returnDays: days,
              replacementAllowed: x.replacementAllowed === true,
              }
            })
          : [
              {
                name: "Default",
                price: "",
                discount: "0",
                hasGst: true,
                stock: "0",
                sku: "",
                images: [],
                imageMode: "upload",
                attributes: [],
                details: "",
                returnType: "NON_RETURNABLE",
                returnDays: "",
                replacementAllowed: false,
              },
            ]
      )
      setVariantPendingFiles(new Array(v.length > 0 ? v.length : 1).fill(null).map(() => []))
      variantPreviewUrlsRef.current = new Array(v.length > 0 ? v.length : 1).fill(null).map(() => [])
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

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      {
        name: "",
        price: "",
        discount: "0",
        hasGst: true,
        stock: "0",
        sku: "",
        images: [],
        imageMode: "upload",
        attributes: [],
        details: "",
        returnType: "NON_RETURNABLE",
        returnDays: "",
        replacementAllowed: false,
      },
    ])
    setVariantPendingFiles((prev) => [...prev, []])
    variantPreviewUrlsRef.current = [...variantPreviewUrlsRef.current, []]
  }
  function removeVariant(index: number) {
    if (variants.length <= 1) return
    setVariants((prev) => prev.filter((_, i) => i !== index))
    setVariantPendingFiles((prev) => prev.filter((_, i) => i !== index))
    ;(variantPreviewUrlsRef.current[index] ?? []).forEach((u) => URL.revokeObjectURL(u))
    variantPreviewUrlsRef.current = variantPreviewUrlsRef.current.filter((_, i) => i !== index)
  }
  function updateVariant(index: number, field: keyof VariantRow, value: string | boolean | string[] | "link" | "upload" | AttributePair[]) {
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
    let selected = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (selected.length > 0) {
      try {
        const { compressImage } = await import("@/lib/image-compressor")
        selected = await Promise.all(selected.map((f) => compressImage(f)))
      } catch {
        // Fallback
      }
      ;(variantPreviewUrlsRef.current[variantIndex] ?? []).forEach((u) => URL.revokeObjectURL(u))
      const previewUrls = selected.map((f) => URL.createObjectURL(f))
      variantPreviewUrlsRef.current[variantIndex] = previewUrls
      setVariantPendingFiles((prev) => {
        const next = [...prev]
        next[variantIndex] = selected
        return next
      })
      setVariants((prev) => {
        const next = [...prev]
        const v = next[variantIndex]
        if (v) next[variantIndex] = { ...v, images: [...(v.images ?? []), ...previewUrls] }
        return next
      })
    }
    setVariantUploadingFor(null)
    e.target.value = ""
  }

  function removeVariantImage(variantIndex: number, url: string) {
    const v = variants[variantIndex]
    if (!v) return
    const previewUrls = variantPreviewUrlsRef.current[variantIndex] ?? []
    const previewIndex = previewUrls.indexOf(url)
    if (previewIndex >= 0) {
      URL.revokeObjectURL(url)
      variantPreviewUrlsRef.current[variantIndex] = previewUrls.filter((_, i) => i !== previewIndex)
      setVariantPendingFiles((prev) => {
        const next = [...prev]
        next[variantIndex] = (next[variantIndex] ?? []).filter((_, i) => i !== previewIndex)
        return next
      })
    }
    updateVariant(variantIndex, "images", (v.images ?? []).filter((u) => u !== url))
  }

  function parseVariantImageLinks(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean)
  }

  useEffect(() => {
    return () => {
      if (masterImagePreviewUrlRef.current) URL.revokeObjectURL(masterImagePreviewUrlRef.current)
      variantPreviewUrlsRef.current.flat().forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  async function uploadFiles(files: File[]): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/product-seller/upload", { method: "POST", body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.url) throw new Error("Image upload failed")
      urls.push(j.url as string)
    }
    return urls
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
      returnType: "NON_RETURNABLE",
      returnDays: "",
      replacementAllowed: false,
    }))
    setVariants(newVariants)
    variantPreviewUrlsRef.current.flat().forEach((u) => URL.revokeObjectURL(u))
    variantPreviewUrlsRef.current = newVariants.map(() => [])
    setVariantPendingFiles(newVariants.map(() => []))
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
    if (!product) return
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get("name") as string)?.trim()
    const categoryId = formData.get("categoryId") as string
    const subcategoryId = (formData.get("subcategoryId") as string) || null
    const description = (formData.get("description") as string) || undefined
    const isActive = (formData.get("isActive") as string) === "true"
    let images = masterImageUrl.trim() ? [masterImageUrl.trim()] : []

    if (!name || !categoryId) {
      setError("Name and category are required")
      return
    }
    if (masterImageMode === "upload" && masterImageFile) {
      try {
        images = await uploadFiles([masterImageFile])
      } catch {
        setError("Master image upload failed. Please try again.")
        return
      }
    }
    const variantsPayload: {
      name: string
      price: number
      discount: number
      hasGst: boolean
      stock: number
      sku?: string
      images?: string[]
      attributes?: Record<string, string>
      details?: string
      returnType?: "NON_RETURNABLE" | "RETURNABLE"
      returnDays?: number
      replacementAllowed?: boolean
    }[] = []
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
      const returnType = v.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
      const daysNum = parseInt(v.returnDays || "", 10)

      let variantImages: string[] | undefined
      try {
        if (v.imageMode === "link") {
          variantImages = Array.isArray(v.images) && v.images.length > 0 ? v.images : undefined
        } else {
          const existingUrls = (v.images ?? []).filter((u) => !u.startsWith("blob:"))
          const uploadedUrls = variantPendingFiles[i]?.length ? await uploadFiles(variantPendingFiles[i]) : []
          const merged = Array.from(new Set([...existingUrls, ...uploadedUrls]))
          variantImages = merged.length > 0 ? merged : undefined
        }
      } catch {
        setError(`Variant ${i + 1}: image upload failed. Please try again.`)
        return
      }

      variantsPayload.push({
        name: v.name.trim() || `Variant ${i + 1}`,
        price,
        discount,
        hasGst: v.hasGst,
        stock,
        sku: v.sku.trim() || undefined,
        images: variantImages,
        attributes: attributesObj && Object.keys(attributesObj).length > 0 ? attributesObj : undefined,
        details: (v.details ?? "").trim() || undefined,
        returnType,
        returnDays: returnType === "RETURNABLE" && !isNaN(daysNum) && daysNum > 0 ? daysNum : undefined,
        replacementAllowed: returnType === "RETURNABLE" && v.replacementAllowed,
      })
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
        isActive,
        condition,
        deliveryChargePerKm: parseFloat(formData.get("deliveryChargePerKm") as string) || 0,
        images,
        variants: variantsPayload,
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

  async function handleMasterFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) {
      e.target.value = ""
      return
    }
    setUploading(true)
    try {
      const { compressImage } = await import("@/lib/image-compressor")
      file = await compressImage(file)
    } catch {
      // Fallback
    }
    if (masterImagePreviewUrl) URL.revokeObjectURL(masterImagePreviewUrl)
    setMasterImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    masterImagePreviewUrlRef.current = previewUrl
    setMasterImagePreviewUrl(previewUrl)
    setUploading(false)
    e.target.value = ""
  }

  if (loading) return <PageLoader variant="detail" message="Loading product…" />
  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Product not found.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 w-full max-w-[1400px]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit Product</h1>
          <p className="text-muted-foreground text-sm mt-1">Update details for this product listing.</p>
        </div>
        <Link href="/product-seller/products">
          <Button variant="outline" size="sm">Back to Products</Button>
        </Link>
      </div>

      {(error || paramsError) && (
        <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <span>⚠️</span> Error updating product:
          </p>
          <p>{error || (paramsError ? decodeURIComponent(paramsError) : "")}</p>
        </div>
      )}

      {paramsSuccess && (
        <div className="mb-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <p>{decodeURIComponent(paramsSuccess)}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* STEP 1: Basic Information */}
        <Card className="shadow-2xl border-2 border-neutral-400 dark:border-neutral-600">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">1</span>
              <div>
                <CardTitle className="text-xl">Basic Product Information</CardTitle>
                <CardDescription className="text-xs mt-0.5">Define the parent product settings. These details apply to all variations.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
                <Input id="name" name="name" required defaultValue={product.name} placeholder="Enter descriptive product name (e.g. Premium Cotton T-Shirt)" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Provide a detailed description of the product features, specifications, and benefits..."
                  defaultValue={product.description || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category <span className="text-destructive">*</span></Label>
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
                  defaultValue={product.subcategoryId ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">None</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Select a category first to load subcategories.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Product Type / Condition <span className="text-destructive">*</span></Label>
                <select
                  id="condition"
                  name="condition"
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as "NEW" | "USED")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="NEW">New</option>
                  <option value="USED">Used</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryChargePerKm">Add per KM Delivery Charge (default 0)</Label>
                <Input 
                  id="deliveryChargePerKm" 
                  name="deliveryChargePerKm" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  defaultValue={product.deliveryChargePerKm || 0} 
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className="border-t pt-6 space-y-3">
              <Label className="text-base font-semibold">Master Image (Listing Thumbnail)</Label>
              <p className="text-xs text-muted-foreground">Main product image. Changing it replaces the current image.</p>
              <div className="flex gap-2 p-1 bg-muted/40 rounded-lg max-w-xs">
                <button
                  type="button"
                  onClick={() => setMasterImageMode("link")}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${masterImageMode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LinkIcon className="h-3 w-3" />
                  Via Link
                </button>
                <button
                  type="button"
                  onClick={() => setMasterImageMode("upload")}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${masterImageMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Upload className="h-3 w-3" />
                  File Upload
                </button>
              </div>

              {masterImageMode === "link" ? (
                <div className="space-y-2 pt-2">
                  <Input
                    type="text"
                    placeholder="/uploads/products/your-image.jpg or https://example.com/image.jpg"
                    value={masterImageUrl}
                    onChange={(e) => {
                      setMasterImageFile(null)
                      if (masterImagePreviewUrl) URL.revokeObjectURL(masterImagePreviewUrl)
                      setMasterImagePreviewUrl("")
                      masterImagePreviewUrlRef.current = ""
                      setMasterImageUrl(e.target.value)
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Enter one image URL. Changing it replaces the current master image.</p>
                  {masterImageUrl && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                      <div className="relative w-32 h-32 rounded overflow-hidden border bg-muted inline-block">
                        <img src={masterImageUrl} alt="Master preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setMasterImageFile(null)
                            if (masterImagePreviewUrl) URL.revokeObjectURL(masterImagePreviewUrl)
                            setMasterImagePreviewUrl("")
                            masterImagePreviewUrlRef.current = ""
                            setMasterImageUrl("")
                          }}
                          className="absolute top-0 right-0 bg-destructive/90 text-destructive-foreground text-xs px-1.5 py-0.5 rounded-bl font-semibold"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <input
                    ref={masterFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleMasterFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => masterFileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Preparing..." : "Choose image (replaces current)"}
                  </Button>
                  {(masterImagePreviewUrl || masterImageUrl) && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-32 h-32 rounded overflow-hidden border bg-muted">
                          <img src={masterImagePreviewUrl || masterImageUrl} alt="Master preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setMasterImageFile(null)
                              if (masterImagePreviewUrl) URL.revokeObjectURL(masterImagePreviewUrl)
                              setMasterImagePreviewUrl("")
                              masterImagePreviewUrlRef.current = ""
                              setMasterImageUrl("")
                            }}
                            className="absolute top-0 right-0 bg-destructive/90 text-destructive-foreground text-xs px-1.5 py-0.5 rounded-bl font-semibold"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* STEP 2: Variant Generator Setup */}
        <Card className="shadow-2xl border-2 border-neutral-400 dark:border-neutral-600">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">2</span>
                <div>
                  <CardTitle className="text-xl flex items-center gap-1.5">
                    <span>Variant Generator</span>
                    <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Optional Shortcut</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">Quickly generate variant combinations based on option groups like Size, Color, or Material.</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="text-xs text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-300 rounded-lg p-3 border border-blue-100 dark:border-blue-900/40">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> How it works:
              </p>
              Add option names and enter values separated by commas. Click Generate to create one variant per combination (e.g. Size M,L,XL × Color Red,Blue = 6 variants).
            </div>

            {generatorOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-center flex-wrap p-3 rounded-lg border bg-muted/20">
                <div className="w-[180px] space-y-1">
                  <Label className="text-xs text-muted-foreground">Option Name</Label>
                  <Input
                    placeholder="e.g. Size or Color"
                    value={opt.optionName}
                    onChange={(e) => updateGeneratorOption(idx, "optionName", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-xs text-muted-foreground">Values (comma separated)</Label>
                  <Input
                    placeholder="e.g. S, M, L or Red, Green"
                    value={opt.valuesText}
                    onChange={(e) => updateGeneratorOption(idx, "valuesText", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="pt-5">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGeneratorOption(idx)} className="text-destructive hover:bg-destructive/10 h-9 w-9">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={addGeneratorOption}>
                <Plus className="h-4 w-4 mr-1" /> Add Option Group
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => generateVariantsFromOptions()}>
                <Zap className="h-4 w-4 mr-1" /> Generate Variant Rows
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* STEP 3: Variants Pricing & Configuration */}
        <Card className="shadow-2xl border-2 border-neutral-400 dark:border-neutral-600">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">3</span>
                <div>
                  <CardTitle className="text-xl">Define Variants & Pricing</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Provide stock, price, images, SKU, and specifications for each unique variant row.</CardDescription>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="h-4 w-4 mr-1" /> Add Custom Variant
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              {variants.map((v, i) => (
                <div key={i} className="rounded-lg border-2 border-neutral-400 dark:border-neutral-600 bg-card text-card-foreground shadow-2xl overflow-hidden">
                  <div className="flex justify-between items-center bg-muted/30 px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">Variant #{i + 1}</span>
                      {v.name && (
                        <span className="text-xs bg-secondary text-secondary-foreground font-medium px-2 py-0.5 rounded-md">
                          {v.name}
                        </span>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)} disabled={variants.length <= 1} className="text-destructive hover:bg-destructive/10 h-8 px-2.5">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* Primary Variant Fields */}
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Variant Name <span className="text-destructive">*</span></Label>
                        <Input placeholder="e.g. Standard, Red / M" value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Price (INR) <span className="text-destructive">*</span></Label>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Discount (INR)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0" value={v.discount} onChange={(e) => updateVariant(i, "discount", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Stock / Inventory <span className="text-destructive">*</span></Label>
                        <Input type="number" min="0" placeholder="0" value={v.stock} onChange={(e) => updateVariant(i, "stock", e.target.value)} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">SKU Code</Label>
                        <Input placeholder="Optional SKU code" value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} />
                      </div>
                      <div className="space-y-1.5 flex items-center pt-5 hidden">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={v.hasGst} onChange={(e) => updateVariant(i, "hasGst", e.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                          <span className="text-xs font-medium">Inclusive of GST</span>
                        </label>
                      </div>
                    </div>

                    {/* Advanced Fields */}
                    <div className="border-t pt-4 grid gap-6 md:grid-cols-2">
                      {/* Left: Images & Details */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Variant Images (Optional)</Label>
                          <p className="text-[11px] text-muted-foreground">Shown specifically when this variant is selected.</p>
                          <div className="flex gap-2 p-1 bg-muted/40 rounded-lg max-w-xs">
                            <button
                              type="button"
                              onClick={() => updateVariant(i, "imageMode", "link")}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${v.imageMode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <LinkIcon className="h-3 w-3" />
                              Link
                            </button>
                            <button
                              type="button"
                              onClick={() => updateVariant(i, "imageMode", "upload")}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${v.imageMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <Upload className="h-3 w-3" />
                              Upload
                            </button>
                          </div>
                        </div>

                        {v.imageMode === "link" ? (
                          <div className="space-y-1.5">
                            <textarea
                              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                              value={Array.isArray(v.images) ? v.images.join(", ") : ""}
                              onChange={(e) => updateVariant(i, "images", parseVariantImageLinks(e.target.value))}
                            />
                            <p className="text-[10px] text-muted-foreground">Comma-separated image URLs.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
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
                              className="text-xs"
                            >
                              {variantUploadingFor === i ? "Uploading..." : "Choose Files"}
                            </Button>
                            {(v.images?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {v.images.map((url) => (
                                  <div key={url} className="relative w-12 h-12 rounded overflow-hidden border bg-muted shadow-sm">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => removeVariantImage(i, url)}
                                      className="absolute top-0 right-0 bg-destructive/90 text-destructive-foreground text-[10px] px-1 rounded-bl"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5 pt-2">
                          <Label className="text-xs font-semibold">Variant-Specific Details (Optional)</Label>
                          <textarea
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="Specifications or description unique to this variant"
                            value={v.details ?? ""}
                            onChange={(e) => updateVariant(i, "details", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Right: Attributes & Return Policy */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">Attributes (Specifications)</Label>
                          <p className="text-[11px] text-muted-foreground">Define attributes specific to this variant.</p>
                          
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {(v.attributes ?? []).map((attr, attrIdx) => (
                              <div key={attrIdx} className="flex gap-2 items-center">
                                <Input
                                  placeholder="e.g. Size"
                                  value={attr.key}
                                  onChange={(e) => updateVariantAttribute(i, attrIdx, "key", e.target.value)}
                                  className="h-8 text-xs flex-1"
                                />
                                <Input
                                  placeholder="e.g. Medium"
                                  value={attr.value}
                                  onChange={(e) => updateVariantAttribute(i, attrIdx, "value", e.target.value)}
                                  className="h-8 text-xs flex-1"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeVariantAttribute(i, attrIdx)} className="text-destructive h-8 w-8 hover:bg-destructive/10 shrink-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <Button type="button" variant="outline" size="sm" onClick={() => addVariantAttribute(i)} className="text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Add Attribute
                          </Button>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-xs font-semibold">Return & Exchange Policy</Label>
                          <div className="flex flex-wrap items-center gap-3">
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              value={v.returnType}
                              onChange={(e) =>
                                updateVariant(i, "returnType", e.target.value as VariantRow["returnType"])
                              }
                            >
                              <option value="NON_RETURNABLE">Non-returnable</option>
                              <option value="RETURNABLE">Returnable</option>
                            </select>
                            {v.returnType === "RETURNABLE" && (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min="1"
                                  className="w-16 h-8 text-xs"
                                  placeholder="Days"
                                  value={v.returnDays}
                                  onChange={(e) => updateVariant(i, "returnDays", e.target.value)}
                                />
                                <span className="text-xs text-muted-foreground">days</span>
                              </div>
                            )}
                          </div>
                          {v.returnType === "RETURNABLE" && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer select-none mt-1">
                              <input
                                type="checkbox"
                                checked={v.replacementAllowed}
                                onChange={(e) => updateVariant(i, "replacementAllowed", e.target.checked)}
                                className="rounded border-input text-primary focus:ring-primary"
                              />
                              <span>Allow customer to exchange for replacement variant</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* STATUS SETTINGS AND ACTIONS */}
        <div className="p-4 rounded-lg border bg-muted/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked={product.isActive}
              value="true"
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer select-none">
              Active / Visible (Visible to customers on frontend website)
            </Label>
          </div>
          <div className="flex gap-3">
            <Link href="/product-seller/products">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" disabled={saving} className="px-8 font-semibold">
              {saving ? "Updating..." : "Update Product"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
