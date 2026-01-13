import { getSellerProducts } from "@/server/actions/products/get-products"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DeleteProductButton } from "@/components/seller/delete-product-button"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { Plus, Package, Edit } from "lucide-react"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const products = await getSellerProducts()
  const params = await searchParams

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage your product listings
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/seller/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      {params.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            {decodeURIComponent(params.error)}
          </AlertDescription>
        </Alert>
      )}

      {params.success && (
        <Alert className="mb-6">
          <AlertDescription>
            {decodeURIComponent(params.success)}
          </AlertDescription>
        </Alert>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first product listing
            </p>
            <Button asChild>
              <Link href="/dashboard/seller/products/new">
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
                    <CardDescription className="mt-1">
                      {product.category.name}
                    </CardDescription>
                  </div>
                  {!product.isActive && (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(product.basePrice)}</p>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Stock: {product.stock} units</p>
                    <p>Variants: {product.variants.length}</p>
                    <p>Orders: {product._count.orderItems} • Reviews: {product._count.reviews}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/dashboard/seller/products/${product.id}`}>
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

