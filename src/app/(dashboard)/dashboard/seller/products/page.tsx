import { getSellerProducts } from "@/server/actions/products/get-products"
import { deleteProduct } from "@/server/actions/products/delete-product"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

export default async function ProductsPage() {
  const products = await getSellerProducts()

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product listings</p>
        </div>
        <Link href="/dashboard/seller/products/new">
          <Button>Add Product</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Link href="/dashboard/seller/products/new">
              <Button>Create Your First Product</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.category.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-2xl font-bold">{formatCurrency(product.basePrice)}</p>
                  <p className="text-sm text-muted-foreground">
                    Stock: {product.stock} | Variants: {product.variants.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Orders: {product._count.orderItems} | Reviews: {product._count.reviews}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Link href={`/dashboard/seller/products/${product.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">Edit</Button>
                    </Link>
                    <form action={deleteProduct.bind(null, product.id)} className="flex-1">
                      <Button type="submit" variant="destructive" className="w-full">
                        Delete
                      </Button>
                    </form>
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

