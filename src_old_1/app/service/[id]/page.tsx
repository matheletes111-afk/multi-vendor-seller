import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/ui/button"

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = await prisma.service.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      seller: { include: { store: true } },
      _count: { select: { reviews: true } },
    },
  })
  if (!service) notFound()

  const images = (service.images as string[]) || []
  const displayPrice = service.basePrice != null ? Math.max(0, service.basePrice - service.discount) : null

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
                <img src={images[0]} alt={service.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square w-full md:w-80 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">{service.category.name}</Badge>
              <CardTitle className="text-2xl">{service.name}</CardTitle>
              <p className="text-muted-foreground mt-2">{service.seller.store?.name || "Store"}</p>
              {displayPrice != null ? (
                <p className="text-2xl font-bold mt-4">{formatCurrency(displayPrice)}</p>
              ) : (
                <p className="text-muted-foreground mt-4">Price on request</p>
              )}
              {service._count.reviews > 0 && (
                <p className="text-sm text-muted-foreground mt-2">{service._count.reviews} review(s)</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {service.description && (
            <div className="prose prose-sm max-w-none">
              <p>{service.description}</p>
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
