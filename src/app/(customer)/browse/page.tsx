import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

export default async function BrowsePage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      seller: {
        include: {
          store: true,
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  })

  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: {
      category: true,
      seller: {
        include: {
          store: true,
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Browse Marketplace</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Products</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} href={`/product/${product.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                  <CardDescription>{product.category.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(product.basePrice)}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {product.seller.store?.name || "Store"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Services</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <Link key={service.id} href={`/service/${service.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{service.name}</CardTitle>
                  <CardDescription>{service.category.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  {service.basePrice && (
                    <p className="text-2xl font-bold">{formatCurrency(service.basePrice)}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {service.seller.store?.name || "Store"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

