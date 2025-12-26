import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { Package, Briefcase } from "lucide-react"

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
    <div className="container mx-auto p-6 space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Marketplace</h1>
        <p className="text-muted-foreground mt-2">
          Discover products and services from our sellers
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <Package className="h-5 w-5" />
          <h2 className="text-2xl font-semibold tracking-tight">Products</h2>
          <Badge variant="secondary">{products.length}</Badge>
        </div>
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No products available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{product.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="text-xs">
                        {product.category.name}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold mb-2">{formatCurrency(product.basePrice)}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.seller.store?.name || "Store"}
                    </p>
                    {product._count.reviews > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {product._count.reviews} review{product._count.reviews !== 1 ? "s" : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <Briefcase className="h-5 w-5" />
          <h2 className="text-2xl font-semibold tracking-tight">Services</h2>
          <Badge variant="secondary">{services.length}</Badge>
        </div>
        {services.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No services available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Link key={service.id} href={`/service/${service.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{service.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="text-xs">
                        {service.category.name}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {service.basePrice ? (
                      <p className="text-2xl font-bold mb-2">{formatCurrency(service.basePrice)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">Price on request</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {service.seller.store?.name || "Store"}
                    </p>
                    {service._count.reviews > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {service._count.reviews} review{service._count.reviews !== 1 ? "s" : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

