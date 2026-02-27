import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeEmbedUrl } from "@/lib/youtube"
import { Package, Briefcase, Megaphone } from "lucide-react"
import Link from "next/link"

export default async function BrowsePage() {
  const now = new Date()
  const sponsoredAdsRaw = await prisma.sellerAd.findMany({
    where: {
      status: "ACTIVE",
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: {
      product: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
    take: 12,
    orderBy: { createdAt: "desc" },
  })
  const sponsoredAds = sponsoredAdsRaw.filter(
    (ad) => Number(ad.spentAmount) < Number(ad.totalBudget)
  )

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

      {sponsoredAds.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Megaphone className="h-5 w-5" />
            <h2 className="text-2xl font-semibold tracking-tight">Sponsored</h2>
            <Badge variant="secondary">{sponsoredAds.length}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sponsoredAds.map((ad) => {
              const youtubeEmbed = ad.creativeType === "VIDEO" ? getYoutubeEmbedUrl(ad.creativeUrl) : null
              return (
              <Link key={ad.id} href={`/api/ads/click?adId=${ad.id}`} className="block">
                <Card className="hover:shadow-md transition-shadow h-full overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    {ad.creativeType === "VIDEO" ? (
                      youtubeEmbed ? (
                        <iframe
                          src={youtubeEmbed}
                          title={ad.title}
                          className="w-full h-full object-cover pointer-events-none"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video src={ad.creativeUrl} className="w-full h-full object-cover" muted />
                      )
                    ) : (
                      <img src={ad.creativeUrl} alt={ad.title} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-2 left-2">
                      <Badge className="bg-primary/90">Sponsored</Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-lg">{ad.title}</CardTitle>
                    <CardDescription>
                      {ad.product ? ad.product.name : ad.service ? ad.service.name : "Ad"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              )
            })}
          </div>
        </section>
      )}

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
              <Card key={product.id} className="hover:shadow-md transition-shadow h-full">
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
              <Card key={service.id} className="hover:shadow-md transition-shadow h-full">
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
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
