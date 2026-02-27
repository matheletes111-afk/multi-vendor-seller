import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/ui/button"

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      seller: { include: { store: true } },
      _count: { select: { reviews: true } },
    },
  })
  if (!product) notFound()

  const images = (product.images as string[]) || []
  const displayPrice = Math.max(0, product.basePrice - product.discount)

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/customer/browse" className="text-sm text-muted-foreground hover:underline">
          ← Back to browse
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-6">
            {images[0] ? (
              <div className="aspect-square w-full md:w-80 shrink-0 rounded-md overflow-hidden bg-muted">
                <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square w-full md:w-80 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">{product.category.name}</Badge>
              <CardTitle className="text-2xl">{product.name}</CardTitle>
              <p className="text-muted-foreground mt-2">{product.seller.store?.name || "Store"}</p>
              <p className="text-2xl font-bold mt-4">{formatCurrency(displayPrice)}</p>
              {product.discount > 0 && (
                <p className="text-sm text-muted-foreground line-through">{formatCurrency(product.basePrice)}</p>
              )}
              {product._count.reviews > 0 && (
                <p className="text-sm text-muted-foreground mt-2">{product._count.reviews} review(s)</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {product.description && (
            <div className="prose prose-sm max-w-none">
              <p>{product.description}</p>
            </div>
          )}
          <div className="mt-6">
            <Button asChild>
              <Link href="/customer/browse">Browse more</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
