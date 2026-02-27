"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
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
import { formatCurrency } from "@/lib/utils"
import { Plus, Package, Pencil, Trash2 } from "lucide-react"

type Product = {
  id: string
  name: string
  basePrice: number
  discount: number
  hasGst: boolean
  stock: number
  isActive: boolean
  images: unknown
  createdAt: string
  category: { name: string }
  subcategory: { name: string } | null
  variants: unknown[]
  _count: { orderItems: number; reviews: number }
}

export function ProductsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/product-seller/products")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  const handleDelete = async (productId: string) => {
    setDeletingId(productId)
    try {
      const res = await fetch(`/api/product-seller/products/${productId}`, { method: "DELETE" })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId))
        router.replace("/product-seller/products?success=Product+deleted+permanently")
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">Manage your product listings</p>
        </div>
        <Button asChild>
          <Link href="/product-seller/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
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
                  <TableHead>Preview</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
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
                    <TableRow key={product.id}>
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
                      <TableCell>
                        <Link href={`/product-seller/products/${product.id}`} className="font-medium hover:underline">
                          {product.name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Stock: {product.stock} · {product.variants.length} variant(s)
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.category.name}
                        {product.subcategory && (
                          <span className="block text-xs">→ {product.subcategory.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(Math.max(0, product.basePrice - product.discount))}</span>
                        {product.discount > 0 && (
                          <span className="text-xs text-muted-foreground block">was {formatCurrency(product.basePrice)}</span>
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
