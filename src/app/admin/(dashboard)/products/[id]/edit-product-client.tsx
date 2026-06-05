"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ArrowLeft, Plus, Trash2, Save, AlertCircle } from "lucide-react"

type VariantInput = {
  id?: string
  name: string
  sku: string
  price: number
  discount: number
  stock: number
  returnType: "RETURNABLE" | "NON_RETURNABLE"
  returnDays: number
  replacementAllowed: boolean
}

export function EditProductClient({ productId }: { productId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null)
  const [condition, setCondition] = useState("NEW")
  const [isActive, setIsActive] = useState(true)
  const [deliveryChargePerKm, setDeliveryChargePerKm] = useState(0)
  const [variants, setVariants] = useState<VariantInput[]>([])

  const [categories, setCategories] = useState<any[]>([])
  const selectedCategory = categories.find((c) => c.id === categoryId)

  useEffect(() => {
    // Fetch product details & categories
    Promise.all([
      fetch(`/api/admin/products/${productId}`).then((r) => r.json()),
      fetch("/api/product-seller/categories").then((r) => r.json().catch(() => [])),
    ])
      .then(([product, cats]) => {
        if (product.error) {
          setError(product.error)
        } else {
          setName(product.name)
          setDescription(product.description || "")
          setCategoryId(product.categoryId)
          setSubcategoryId(product.subcategoryId)
          setCondition(product.condition)
          setIsActive(product.isActive)
          setDeliveryChargePerKm(product.deliveryChargePerKm || 0)
          setVariants(
            product.variants.map((v: any) => ({
              id: v.id,
              name: v.name,
              sku: v.sku || "",
              price: v.price,
              discount: v.discount || 0,
              stock: v.stock || 0,
              returnType: v.returnType || "NON_RETURNABLE",
              returnDays: v.returnDays || 0,
              replacementAllowed: v.replacementAllowed === true,
            }))
          )
        }
        setCategories(Array.isArray(cats) ? cats : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [productId])

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        name: "Standard Variant",
        sku: "",
        price: 100,
        discount: 0,
        stock: 10,
        returnType: "NON_RETURNABLE",
        returnDays: 0,
        replacementAllowed: false,
      },
    ])
  }

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleVariantChange = (index: number, field: keyof VariantInput, value: any) => {
    setVariants((prev) =>
      prev.map((v, i) => {
        if (i === index) {
          return { ...v, [field]: value }
        }
        return v
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError("Name is required")
    if (!categoryId) return setError("Category is required")
    if (variants.length === 0) return setError("At least one variant is required")

    // Price/stock validation
    for (const v of variants) {
      if (isNaN(v.price) || v.price <= 0) return setError(`Variant "${v.name}" price must be greater than 0`)
      if (isNaN(v.stock) || v.stock < 0) return setError(`Variant "${v.name}" stock must be at least 0`)
      if (v.discount < 0 || v.discount > v.price) return setError(`Discount for "${v.name}" must be between 0 and price`)
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          categoryId,
          subcategoryId: subcategoryId === "NONE" ? null : subcategoryId,
          condition,
          isActive,
          deliveryChargePerKm,
          variants,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")

      router.push("/admin/products?success=Product+updated+successfully")
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      window.scrollTo(0, 0)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader message="Loading editor..." />

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-muted" onClick={() => router.push("/admin/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Edit Product (Admin Mode)</h1>
          <p className="text-muted-foreground text-sm font-medium">Bypass seller checks to update core properties.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-semibold">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-background">
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase tracking-wider text-primary/80">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prodName" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Product Name</Label>
              <Input
                id="prodName"
                className="rounded-2xl h-12 bg-background border-muted"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prodDesc" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
              <Textarea
                id="prodDesc"
                className="rounded-2xl min-h-[120px] bg-background border-muted"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Category</Label>
                <Select value={categoryId} onValueChange={(val) => { setCategoryId(val); setSubcategoryId(null) }}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Subcategory</Label>
                <Select
                  value={subcategoryId || "NONE"}
                  onValueChange={(val) => setSubcategoryId(val === "NONE" ? null : val)}
                  disabled={!selectedCategory || !selectedCategory.subcategories?.length}
                >
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="No Subcategory" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="NONE">None</SelectItem>
                    {selectedCategory?.subcategories?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="USED">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Active Status</Label>
                <Select value={isActive ? "active" : "inactive"} onValueChange={(val) => setIsActive(val === "active")}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background border-muted">
                    <SelectValue placeholder="Active Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delCharge" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Delivery Charge / Km</Label>
                <Input
                  id="delCharge"
                  type="number"
                  step="0.01"
                  className="rounded-2xl h-12 bg-background border-muted"
                  value={deliveryChargePerKm}
                  onChange={(e) => setDeliveryChargePerKm(Number(e.target.value || 0))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variants editor */}
        <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-background">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold uppercase tracking-wider text-primary/80">Product Variants</CardTitle>
            <Button type="button" size="sm" className="rounded-xl px-4" onClick={handleAddVariant}>
              <Plus className="h-4 w-4 mr-2" /> Add Variant
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {variants.map((v, index) => (
              <div key={index} className="p-5 border rounded-2xl bg-muted/10 relative space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase py-0.5 px-3 bg-muted/40 border-muted">
                    Variant #{index + 1}
                  </Badge>
                  {variants.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" onClick={() => handleRemoveVariant(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Variant Name</Label>
                    <Input
                      className="rounded-xl h-11 bg-background border-muted"
                      value={v.name}
                      onChange={(e) => handleVariantChange(index, "name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">SKU</Label>
                    <Input
                      className="rounded-xl h-11 bg-background border-muted font-mono"
                      value={v.sku}
                      onChange={(e) => handleVariantChange(index, "sku", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Stock</Label>
                    <Input
                      type="number"
                      className="rounded-xl h-11 bg-background border-muted"
                      value={v.stock}
                      onChange={(e) => handleVariantChange(index, "stock", Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Base Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="rounded-xl h-11 bg-background border-muted"
                      value={v.price}
                      onChange={(e) => handleVariantChange(index, "price", Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Discount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="rounded-xl h-11 bg-background border-muted"
                      value={v.discount}
                      onChange={(e) => handleVariantChange(index, "discount", Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Returns Mode</Label>
                    <Select value={v.returnType} onValueChange={(val) => handleVariantChange(index, "returnType", val)}>
                      <SelectTrigger className="rounded-xl h-11 bg-background border-muted">
                        <SelectValue placeholder="Returns" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-xl">
                        <SelectItem value="NON_RETURNABLE">Non Returnable</SelectItem>
                        <SelectItem value="RETURNABLE">Returnable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {v.returnType === "RETURNABLE" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Return Duration (Days)</Label>
                      <Input
                        type="number"
                        className="rounded-xl h-11 bg-background border-muted"
                        value={v.returnDays}
                        onChange={(e) => handleVariantChange(index, "returnDays", Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Exchanges/Replacements</Label>
                      <Select value={v.replacementAllowed ? "allowed" : "disallowed"} onValueChange={(val) => handleVariantChange(index, "replacementAllowed", val === "allowed")}>
                        <SelectTrigger className="rounded-xl h-11 bg-background border-muted">
                          <SelectValue placeholder="Replacement" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-xl">
                          <SelectItem value="disallowed">Disallowed</SelectItem>
                          <SelectItem value="allowed">Allowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full px-6 h-12" onClick={() => router.push("/admin/products")} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-full px-8 h-12 font-bold shadow-lg shadow-primary/20" disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving Changes..." : "Save Product Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
