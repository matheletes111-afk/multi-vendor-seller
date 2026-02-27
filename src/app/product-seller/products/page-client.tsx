"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
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
import { Plus, Package, Edit, Trash2 } from "lucide-react"

type Product = {
  id: string
  name: string
  basePrice: number
  discount: number
  hasGst: boolean
  stock: number
  isActive: boolean
  category: { name: string }
  variants: unknown[]
  _count: { orderItems: number; reviews: number }
}

export function ProductsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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
    const res = await fetch(`/api/product-seller/products/${productId}`, { method: "DELETE" })
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== productId))
      router.replace("/product-seller/products?success=Product+deleted+permanently")
    } else {
      const data = await res.json().catch(() => ({}))
      router.replace(`/product-seller/products?error=${encodeURIComponent(data.error || "Delete failed")}`)
    }
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                    <CardDescription className="mt-1">{product.category.name}</CardDescription>
                  </div>
                  <Badge variant={product.isActive ? "default" : "secondary"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Base {formatCurrency(product.basePrice)}
                      {product.discount > 0 && <> · {formatCurrency(product.discount)} off</>}
                    </p>
                    <p className="text-xl font-bold">{formatCurrency(Math.max(0, product.basePrice - product.discount))} per item</p>
                    <p className="text-xs text-muted-foreground">{product.hasGst ? "15% GST at checkout" : "No GST"}</p>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Stock: {product.stock} units</p>
                    <p>Variants: {product.variants.length}</p>
                    <p>Orders: {product._count.orderItems} • Reviews: {product._count.reviews}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/product-seller/products/${product.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <div className="flex-1">
                      <DeleteProductButton
                        productId={product.id}
                        productName={product.name}
                        orderItemsCount={product._count.orderItems}
                        variantsCount={product.variants.length}
                        onDelete={handleDelete}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteProductButton({
  productId,
  productName,
  orderItemsCount,
  variantsCount,
  onDelete,
}: {
  productId: string
  productName: string
  orderItemsCount: number
  variantsCount: number
  onDelete: (productId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const hasOrders = orderItemsCount > 0

  async function handleDelete() {
    setIsDeleting(true)
    await onDelete(productId)
    setOpen(false)
    setIsDeleting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full">
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
