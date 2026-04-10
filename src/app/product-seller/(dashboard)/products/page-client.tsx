"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Plus, Package, Pencil, Trash2, Megaphone, Search, X, Calendar, Filter } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { BulkUploadDialog } from "./bulk-upload-dialog"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import Checkbox from "@/ui/checkbox-v2"

type Product = {
  id: string
  name: string
  isActive: boolean
  images: unknown
  createdAt: string
  category: { name: string }
  subcategory: { name: string } | null
  variants: { price: number; discount: number; stock: number }[]
  _count: { orderItems: number; reviews: number }
}

/** Long names truncate; "View more" expands inline (does not navigate). */
function ProductNameCell({ name, variantSummary }: { name: string; variantSummary: string }) {
  const [expanded, setExpanded] = useState(false)
  const likelyOverflows = name.length > 32

  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium text-foreground",
            expanded ? "break-words" : "truncate"
          )}
        >
          {name}
        </p>
        <p className="text-xs text-muted-foreground/90 mt-0.5 truncate">{variantSummary}</p>
      </div>
      {likelyOverflows && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs font-medium text-primary shrink-0 whitespace-nowrap pt-0.5 hover:underline"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  )
}

export function ProductsPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  // Filters
  const qStr = searchParams.get("q") ?? ""
  const startStr = searchParams.get("startDate") ?? ""
  const endStr = searchParams.get("endDate") ?? ""
  const catIdStr = searchParams.get("categoryId") ?? ""
  const subCatIdStr = searchParams.get("subcategoryId") ?? ""
  const minPriceStr = searchParams.get("minPrice") ?? ""
  const maxPriceStr = searchParams.get("maxPrice") ?? ""

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

  // Local filter state
  const [q, setQ] = useState(qStr)
  const [startDate, setStartDate] = useState(startStr)
  const [endDate, setEndDate] = useState(endStr)
  const [categoryId, setCategoryId] = useState(catIdStr)
  const [subcategoryId, setSubcategoryId] = useState(subCatIdStr)
  const [minPrice, setMinPrice] = useState(minPriceStr)
  const [maxPrice, setMaxPrice] = useState(maxPriceStr)

  const [allCategories, setAllCategories] = useState<any[]>([])
  const [loadingCats, setLoadingCats] = useState(false)

  const selectedCategory = allCategories.find((c) => c.id === categoryId)

  const loadCategories = useCallback(() => {
    setLoadingCats(true)
    fetch("/api/product-seller/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllCategories(Array.isArray(data) ? data : []))
      .catch(() => setAllCategories([]))
      .finally(() => setLoadingCats(false))
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const loadProducts = useCallback(() => {
    setLoading(true)
    setImageErrors(new Set())

    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (qStr) params.set("q", qStr)
    if (startStr) params.set("startDate", startStr)
    if (endStr) params.set("endDate", endStr)
    if (catIdStr) params.set("categoryId", catIdStr)
    if (subCatIdStr) params.set("subcategoryId", subCatIdStr)
    if (minPriceStr) params.set("minPrice", minPriceStr)
    if (maxPriceStr) params.set("maxPrice", maxPriceStr)

    return fetch(`/api/product-seller/products?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.products) {
          setProducts(json.products)
          setTotalCount(json.totalCount ?? 0)
          setTotalPages(json.totalPages ?? 1)
        } else {
          setProducts([])
          setTotalCount(0)
          setTotalPages(1)
        }
      })
      .catch(() => {
        setProducts([])
        setTotalCount(0)
        setTotalPages(1)
      })
      .finally(() => setLoading(false))
  }, [page, perPage, qStr, startStr, endStr, catIdStr, subCatIdStr, minPriceStr, maxPriceStr])

  useEffect(() => {
    loadProducts()
    setSelectedIds(new Set()) // Reset selection on page/filter change
  }, [loadProducts])

  // Reset local state when URL params change (e.g. on "Clear")
  useEffect(() => {
    setQ(qStr)
    setStartDate(startStr)
    setEndDate(endStr)
    setCategoryId(catIdStr)
    setSubcategoryId(subCatIdStr)
    setMinPrice(minPriceStr)
    setMaxPrice(maxPriceStr)
  }, [qStr, startStr, endStr, catIdStr, subCatIdStr, minPriceStr, maxPriceStr])

  const handleSearch = () => {
    const p = {
      q: q || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      categoryId: (categoryId && categoryId !== "ALL_CATS") ? categoryId : undefined,
      subcategoryId: (subcategoryId && subcategoryId !== "ALL_SUBS") ? subcategoryId : undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    }
    router.push(buildAdminPageUrl("/product-seller/products", 1, p))
  }

  const handleClear = () => {
    setQ("")
    setStartDate("")
    setEndDate("")
    setCategoryId("")
    setSubcategoryId("")
    setMinPrice("")
    setMaxPrice("")
    router.push("/product-seller/products")
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
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
      const res = await fetch("/api/product-seller/products", {
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
      router.replace("/product-seller/products?success=Products+deleted+successfully")
    } catch (e: any) {
      router.replace(`/product-seller/products?error=${encodeURIComponent(e.message)}`)
    } finally {
      setIsBulkDeleting(false)
      setIsBulkDeleteDialogOpen(false)
    }
  }

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")
  const paginationParams = {
    error: paramsError ?? undefined,
    success: paramsSuccess ?? undefined,
    q: qStr || undefined,
    startDate: startStr || undefined,
    endDate: endStr || undefined,
    categoryId: catIdStr || undefined,
    subcategoryId: subCatIdStr || undefined,
    minPrice: minPriceStr || undefined,
    maxPrice: maxPriceStr || undefined,
  }

  const handleDelete = async (productId: string) => {
    setDeletingId(productId)
    const wasLastOnPage = products.length === 1
    try {
      const res = await fetch(`/api/product-seller/products/${productId}`, { method: "DELETE" })
      if (res.ok) {
        if (wasLastOnPage && page > 1) {
          router.replace(`/product-seller/products?page=${page - 1}&success=Product+deleted+permanently`)
        } else {
          await loadProducts()
          router.replace("/product-seller/products?success=Product+deleted+permanently")
        }
      } else {
        const data = await res.json().catch(() => ({}))
        router.replace(`/product-seller/products?error=${encodeURIComponent(data.error || "Delete failed")}`)
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleImageError = (id: string) => {
    setImageErrors((prev) => new Set(prev).add(id))
  }

  function firstImageUrl(p: Product): string | null {
    const imgs = Array.isArray(p.images) ? p.images : typeof p.images === "string" ? (() => { try { return JSON.parse(p.images as string) as string[] } catch { return [] } })() : []
    return imgs.length > 0 ? (imgs[0] as string) : null
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) return <PageLoader variant="listing" message="Loading products…" />

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">Manage your product listings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BulkUploadDialog onImported={loadProducts} />
          <Button asChild>
            <Link href="/product-seller/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {paramsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsError)}</AlertDescription>
        </Alert>
      )}
      {paramsSuccess && (
        <Alert className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription>
        </Alert>
      )}

      {/* Filter Section */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-background via-background to-muted/20 rounded-3xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* Product Name */}
            <div className="space-y-1.5 font-medium">
              <Label htmlFor="search-q" className="text-xs text-muted-foreground uppercase tracking-wider ml-1">Product Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-q"
                  placeholder="Seach products..."
                  className="pl-9 bg-background/50 border-muted rounded-xl h-10"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5 font-medium">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider ml-1">Main Category</Label>
              <Select value={categoryId} onValueChange={(val) => { setCategoryId(val); setSubcategoryId("") }}>
                <SelectTrigger className="bg-background/50 border-muted rounded-xl h-10 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CATS">All Categories</SelectItem>
                  {allCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            <div className="space-y-1.5 font-medium">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider ml-1">Subcategory</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
                disabled={!selectedCategory || !selectedCategory.subcategories?.length}
              >
                <SelectTrigger className="bg-background/50 border-muted rounded-xl h-10 text-xs text-left">
                  <SelectValue placeholder={selectedCategory?.subcategories?.length ? "All Subcategories" : "No Subcategories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_SUBS">All Subcategories</SelectItem>
                  {selectedCategory?.subcategories?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-1.5 font-medium lg:col-span-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider ml-1">Price Range</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  className="bg-background/50 border-muted rounded-xl h-10 text-xs"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span className="text-muted-foreground">−</span>
                <Input
                  type="number"
                  placeholder="Max"
                  className="bg-background/50 border-muted rounded-xl h-10 text-xs"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-1.5 font-medium lg:col-span-1 xl:col-span-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider ml-1">Created Date</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                  <Input
                    type="date"
                    className="pl-7 bg-background/50 border-muted rounded-xl h-10 text-[10px]"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground">−</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                  <Input
                    type="date"
                    className="pl-7 bg-background/50 border-muted rounded-xl h-10 text-[10px]"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2 xl:col-span-5 justify-end pt-2">
              <Button
                variant="outline"
                className="rounded-xl px-6 h-10 font-medium gap-2 text-xs"
                onClick={handleClear}
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                className="rounded-xl px-8 h-10 font-bold gap-2 text-xs shadow-lg shadow-primary/20"
                onClick={handleSearch}
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <Badge className="rounded-full px-3 bg-primary text-primary-foreground">
              {selectedIds.size} Selected
            </Badge>
            <p className="text-sm font-medium text-muted-foreground">items ready for bulk action</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl border-muted-foreground/20"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect All
            </Button>
            <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="rounded-xl shadow-lg shadow-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Delete Products</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete {selectedIds.size} product(s)? This action will remove all selected products and their variants. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>Cancel</Button>
                  <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                    {isBulkDeleting ? "Deleting..." : "Yes, Delete All Selected"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">Get started by creating your first product listing</p>
            <Button asChild>
              <Link href="/product-seller/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Product
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={products.length > 0 && selectedIds.size === products.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="min-w-[200px] max-w-[280px]">Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const imgUrl = firstImageUrl(product)
                  return (
                    <TableRow key={product.id} className={cn(selectedIds.has(product.id) && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelectOne(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {imgUrl && !imageErrors.has(product.id) ? (
                          <div className="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                            <img
                              src={imgUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={() => handleImageError(product.id)}
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                            No image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-0 max-w-[280px]">
                        <ProductNameCell
                          name={product.name}
                          variantSummary={`${product.variants.length} variant(s)${product.variants[0] != null ? ` · Stock: ${product.variants[0].stock}` : ""
                            }`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.category.name}
                        {product.subcategory && (
                          <span className="block text-xs">→ {product.subcategory.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.variants[0] != null ? (
                          <>
                            <span className="font-medium">{formatCurrency(Math.max(0, product.variants[0].price - (product.variants[0].discount ?? 0)))}</span>
                            {(product.variants[0].discount ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground block">was {formatCurrency(product.variants[0].price)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(product.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/product-seller/admanagement/new?productId=${product.id}`}>
                            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                              <Megaphone className="mr-2 h-4 w-4" />
                              Promote
                            </Button>
                          </Link>
                          <Link href={`/product-seller/products/${product.id}`}>
                            <Button variant="outline" size="sm">
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <DeleteProductDialog
                            productId={product.id}
                            productName={product.name}
                            orderItemsCount={product._count.orderItems}
                            variantsCount={product.variants.length}
                            onDelete={() => handleDelete(product.id)}
                            isDeleting={deletingId === product.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/product-seller/products"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={paginationParams}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

function DeleteProductDialog({
  productId,
  productName,
  orderItemsCount,
  variantsCount,
  onDelete,
  isDeleting,
}: {
  productId: string
  productName: string
  orderItemsCount: number
  variantsCount: number
  onDelete: () => Promise<void>
  isDeleting: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasOrders = orderItemsCount > 0

  async function handleDelete() {
    await onDelete()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            {hasOrders ? (
              <>Warning: This product &quot;{productName}&quot; has {orderItemsCount} order(s). Deleting will remove it and {variantsCount} variant(s). Are you sure?</>
            ) : (
              <>Are you sure you want to permanently delete &quot;{productName}&quot;? This will delete the product and {variantsCount} variant(s). This cannot be undone.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
