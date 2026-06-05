"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Pencil, Trash2, Search, X, Calendar, Filter, Eye, Package, AlertCircle } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import Checkbox from "@/ui/checkbox-v2"

type Product = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  images: unknown
  condition: string
  deliveryChargePerKm: number
  createdAt: string
  category: { id: string; name: string }
  subcategory: { id: string; name: string } | null
  seller: { id: string; store: { name: string } | null; user: { name: string | null; email: string } }
  variants: { id: string; name: string; sku: string | null; price: number; discount: number; stock: number; hasGst: boolean; returnType: string; returnDays: number | null; replacementAllowed: boolean }[]
  _count: { orderItems: number; reviews: number }
}

export function ProductsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  // Filters from URL
  const searchQ = searchParams.get("search") ?? ""
  const sellerIdParam = searchParams.get("sellerId") ?? "all"
  const categoryIdParam = searchParams.get("categoryId") ?? "all"
  const statusParam = searchParams.get("status") ?? "all"
  const conditionParam = searchParams.get("condition") ?? "all"
  const startParam = searchParams.get("startDate") ?? ""
  const endParam = searchParams.get("endDate") ?? ""

  // Local state
  const [searchInput, setSearchInput] = useState(searchQ)
  const [localSellerId, setLocalSellerId] = useState(sellerIdParam)
  const [localCategoryId, setLocalCategoryId] = useState(categoryIdParam)
  const [localStatus, setLocalStatus] = useState(statusParam)
  const [localCondition, setLocalCondition] = useState(conditionParam)
  const [startDate, setStartDate] = useState(startParam)
  const [endDate, setEndDate] = useState(endParam)

  const [data, setData] = useState<{
    products: Product[]
    productSellers: any[]
    categories: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)

  const loadProducts = useCallback(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (searchQ) params.set("search", searchQ)
    if (sellerIdParam !== "all") params.set("sellerId", sellerIdParam)
    if (categoryIdParam !== "all") params.set("categoryId", categoryIdParam)
    if (statusParam !== "all") params.set("status", statusParam)
    if (conditionParam !== "all") params.set("condition", conditionParam)
    if (startParam) params.set("startDate", startParam)
    if (endParam) params.set("endDate", endParam)

    fetch(`/api/admin/products?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch products")
        return res.json()
      })
      .then((json) => {
        setData(json)
      })
      .catch((e) => {
        setError(e.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [page, perPage, searchQ, sellerIdParam, categoryIdParam, statusParam, conditionParam, startParam, endParam])

  useEffect(() => {
    loadProducts()
    setSelectedIds(new Set())
  }, [loadProducts])

  useEffect(() => {
    setSearchInput(searchQ)
    setLocalSellerId(sellerIdParam)
    setLocalCategoryId(categoryIdParam)
    setLocalStatus(statusParam)
    setLocalCondition(conditionParam)
    setStartDate(startParam)
    setEndDate(endParam)
  }, [searchQ, sellerIdParam, categoryIdParam, statusParam, conditionParam, startParam, endParam])

  const handleSearch = () => {
    const params = {
      search: searchInput || undefined,
      sellerId: localSellerId === "all" ? undefined : localSellerId,
      categoryId: localCategoryId === "all" ? undefined : localCategoryId,
      status: localStatus === "all" ? undefined : localStatus,
      condition: localCondition === "all" ? undefined : localCondition,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }
    router.push(buildAdminPageUrl("/admin/products", 1, params))
  }

  const handleClear = () => {
    setSearchInput("")
    setLocalSellerId("all")
    setLocalCategoryId("all")
    setLocalStatus("all")
    setLocalCondition("all")
    setStartDate("")
    setEndDate("")
    router.push("/admin/products")
  }

  const toggleSelectAll = () => {
    if (data?.products && selectedIds.size === data.products.length && data.products.length > 0) {
      setSelectedIds(new Set())
    } else if (data?.products) {
      setSelectedIds(new Set(data.products.map((p) => p.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setIsBulkDeleting(true)
    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Bulk delete failed")
      }
      setSelectedIds(new Set())
      await loadProducts()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsBulkDeleting(false)
      setIsBulkDeleteDialogOpen(false)
    }
  }

  const handleDelete = async (productId: string) => {
    setDeletingId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" })
      if (res.ok) {
        await loadProducts()
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Delete failed")
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  function firstImageUrl(p: Product): string | null {
    const imgs = Array.isArray(p.images)
      ? p.images
      : typeof p.images === "string"
      ? (() => {
          try {
            return JSON.parse(p.images as string) as string[]
          } catch {
            return []
          }
        })()
      : []
    return imgs.length > 0 ? (imgs[0] as string) : null
  }

  const paginationParams = {
    search: searchQ || undefined,
    sellerId: sellerIdParam !== "all" ? sellerIdParam : undefined,
    categoryId: categoryIdParam !== "all" ? categoryIdParam : undefined,
    status: statusParam !== "all" ? statusParam : undefined,
    condition: conditionParam !== "all" ? conditionParam : undefined,
    startDate: startParam || undefined,
    endDate: endParam || undefined,
  }

  if (loading && !data) return <PageLoader message="Loading products..." />

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Product Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Moderate and edit products listed by all sellers.</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold shadow-sm">
              {data.totalCount} Total Products
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter Section */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2 mb-6 px-4">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
          <div className="px-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              {/* Product Search */}
              <div className="flex-1 min-w-[250px] max-w-[350px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Search Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, description..."
                    className="pl-9 rounded-2xl h-12 bg-background/50 border-muted focus-visible:ring-primary/20"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              {/* Seller Filter */}
              <div className="w-[220px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Filter by Seller</Label>
                <Select value={localSellerId} onValueChange={setLocalSellerId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Sellers" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Sellers</SelectItem>
                    {data?.productSellers?.map((seller: any) => {
                      const businessName = seller.store?.name || seller.user?.name || "Seller"
                      return (
                        <SelectItem key={seller.id} value={seller.id}>
                          {businessName} ({seller.user.email})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="w-[180px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Filter by Category</Label>
                <Select value={localCategoryId} onValueChange={setLocalCategoryId}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Categories</SelectItem>
                    {data?.categories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[150px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                <Select value={localStatus} onValueChange={setLocalStatus}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="min-w-[320px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Registration Date</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground opacity-70" />
                    <Input
                      type="date"
                      className="pl-9 rounded-2xl text-xs h-12 w-full bg-background/50 border-muted"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <span className="text-muted-foreground">−</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground opacity-70" />
                    <Input
                      type="date"
                      className="pl-9 rounded-2xl text-xs h-12 w-full bg-background/50 border-muted"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 py-0.5 ml-auto">
                <Button variant="outline" onClick={handleClear} className="rounded-2xl px-6 h-12 font-medium border-muted hover:bg-muted/50">
                  <X className="h-4 w-4 mr-2" /> Reset
                </Button>
                <Button onClick={handleSearch} className="rounded-2xl px-8 h-12 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                  <Search className="h-4 w-4 mr-2" /> Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Bulk delete bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-8 py-4 bg-primary/5 border-t border-b border-primary/10 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <Badge className="rounded-full px-3 bg-primary text-primary-foreground">
                {selectedIds.size} Selected
              </Badge>
              <p className="text-sm font-medium text-muted-foreground">ready for bulk action</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedIds(new Set())}>
                Deselect All
              </Button>
              <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-xl shadow-lg shadow-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Delete Products</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to soft delete {selectedIds.size} product(s)? This will hide them from the store, but preserves order history.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>Cancel</Button>
                    <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                      {isBulkDeleting ? "Deleting..." : "Yes, Soft Delete All Selected"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[50px] pl-8">
                  <Checkbox
                    checked={data?.products && data.products.length > 0 && selectedIds.size === data.products.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Product details</TableHead>
                <TableHead>Category / Subcategory</TableHead>
                <TableHead>Seller / Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-32">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <Package className="h-16 w-16" />
                      <p className="font-black uppercase tracking-[0.3em] text-sm">No products found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.products?.map((product) => {
                  const imgUrl = firstImageUrl(product)
                  return (
                    <TableRow key={product.id} className={cn("group transition-all hover:bg-muted/20 border-b border-muted/10", selectedIds.has(product.id) && "bg-primary/5")}>
                      <TableCell className="pl-8">
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelectOne(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {imgUrl ? (
                          <img src={imgUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold border">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-snug">{product.name}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                            {product.variants.length} variant(s) · Stock: {product.variants.reduce((acc, v) => acc + v.stock, 0)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs font-semibold">
                          <span>{product.category.name}</span>
                          {product.subcategory && (
                            <span className="text-[10px] text-muted-foreground">→ {product.subcategory.name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs">{product.seller.store?.name || "No Store"}</span>
                          <span className="text-[10px] text-muted-foreground">{product.seller.user.name || product.seller.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("rounded-full uppercase tracking-widest text-[8px] font-black px-2.5 py-0.5 border-none", product.isActive ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {new Date(product.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end items-center gap-2">
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm" onClick={() => setViewProduct(product)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-amber-50 hover:text-amber-600 transition-all shadow-sm">
                            <Link href={`/admin/products/${product.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DeleteDialog
                            name={product.name}
                            onDelete={() => handleDelete(product.id)}
                            isDeleting={deletingId === product.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {data && (
            <div className="p-8 border-t border-muted/10 bg-muted/5">
              <AdminPagination
                basePath="/admin/products"
                currentPage={page}
                totalPages={data.totalPages}
                totalCount={data.totalCount}
                pageSize={perPage}
                params={paginationParams}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewProduct !== null} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="max-w-3xl rounded-[2rem] border-none shadow-2xl p-6 overflow-y-auto max-h-[85vh]">
          {viewProduct && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary font-bold uppercase tracking-widest text-[9px] px-3 py-1 bg-primary/5 border-primary/20 rounded-full">
                    Product Details
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black mt-2">{viewProduct.name}</DialogTitle>
                <DialogDescription className="text-sm font-semibold opacity-70">
                  Seller: {viewProduct.seller.store?.name || "No Store"} ({viewProduct.seller.user.email})
                </DialogDescription>
              </DialogHeader>

              {/* Grid info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-2xl border text-xs font-semibold">
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Category</span>
                  <span className="text-sm mt-0.5 block">{viewProduct.category.name}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Subcategory</span>
                  <span className="text-sm mt-0.5 block">{viewProduct.subcategory?.name || "—"}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Condition</span>
                  <Badge className="mt-1 bg-indigo-500 text-white rounded-full text-[9px] uppercase px-2 py-0.5 border-none">{viewProduct.condition}</Badge>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Delivery Charge / Km</span>
                  <span className="text-sm mt-0.5 block">{formatCurrency(viewProduct.deliveryChargePerKm)}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Description</h4>
                <p className="text-sm text-foreground/90 bg-muted/10 p-3 border rounded-xl leading-relaxed whitespace-pre-wrap">{viewProduct.description || "No description provided."}</p>
              </div>

              {/* Variants */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Variants</h4>
                <div className="border rounded-2xl overflow-hidden shadow-inner">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Variant Name</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">SKU</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">Stock</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">Price</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">Discount</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">Final Price</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold py-3">Returns</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewProduct.variants.map((v) => (
                        <TableRow key={v.id} className="text-xs border-b border-muted/10">
                          <TableCell className="font-bold py-3.5 pl-4">{v.name}</TableCell>
                          <TableCell className="font-mono text-muted-foreground font-semibold">{v.sku || "—"}</TableCell>
                          <TableCell className="font-bold">{v.stock}</TableCell>
                          <TableCell className="font-semibold text-muted-foreground line-through">{formatCurrency(v.price)}</TableCell>
                          <TableCell className="font-bold text-red-500">-{formatCurrency(v.discount)}</TableCell>
                          <TableCell className="font-black text-green-600">{formatCurrency(Math.max(0, v.price - v.discount))}</TableCell>
                          <TableCell className="font-semibold">
                            {v.returnType === "RETURNABLE" ? `${v.returnDays} days` : "Non-returnable"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button className="rounded-full px-6 font-semibold" onClick={() => setViewProduct(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeleteDialog({
  name,
  onDelete,
  isDeleting,
}: {
  name: string
  onDelete: () => Promise<void>
  isDeleting: boolean
}) {
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    await onDelete()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Soft Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to soft delete &quot;{name}&quot;? It will be deactivated and hidden from the store, but purchase histories will remain intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Yes, Soft Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
