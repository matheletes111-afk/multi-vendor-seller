import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Package, Store, Star } from "lucide-react"

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      seller: {
        include: {
          store: true,
        },
      },
      variants: true,
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  })

  if (!product) {
    notFound()
  }

  const images = Array.isArray(product.images) ? product.images as string[] : []

  return (
    <div className="container mx-auto p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {images.length > 0 ? (
            <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
              <img
                src={images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{product.category.name}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{product.name}</h1>
            <p className="text-4xl font-bold">{formatCurrency(product.basePrice)}</p>
          </div>

          <Separator />

          {product.description && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground">{product.description}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Stock: {product.stock} units</span>
            </div>
            {product._count.reviews > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                <span>{product._count.reviews} review{product._count.reviews !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Store className="h-4 w-4" />
              <span>Sold by: {product.seller.store?.name || "Store"}</span>
            </div>
          </div>

          {product.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <span className="font-medium">{variant.name}</span>
                      <span className="font-semibold">{formatCurrency(variant.price)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" size="lg">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  )
}

