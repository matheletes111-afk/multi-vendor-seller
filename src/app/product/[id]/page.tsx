import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

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

  return (
    <div className="container mx-auto py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-96 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              No Image
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          <p className="text-muted-foreground mb-4">{product.category.name}</p>
          <p className="text-4xl font-bold mb-4">{formatCurrency(product.basePrice)}</p>
          {product.description && (
            <p className="text-muted-foreground mb-6">{product.description}</p>
          )}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Stock: {product.stock}</p>
              {product.variants.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Variants:</p>
                  <div className="space-y-2">
                    {product.variants.map((variant) => (
                      <div key={variant.id} className="flex justify-between items-center p-2 border rounded">
                        <span>{variant.name}</span>
                        <span>{formatCurrency(variant.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button className="w-full">Add to Cart</Button>
            <p className="text-sm text-muted-foreground">
              Sold by: {product.seller.store?.name || "Store"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

