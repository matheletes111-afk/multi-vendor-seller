"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { getYoutubeEmbedUrl } from "@/lib/youtube"
import { Package, Briefcase, Megaphone, ShoppingBag } from "lucide-react"

type Ad = {
  id: string
  title: string
  creativeType: string
  creativeUrl: string
  product: { id: string; name: string } | null
  service: { id: string; name: string } | null
}
type Product = {
  id: string
  name: string
  basePrice: number
  discount?: number
  images: string[] | unknown
  category: { name: string }
  seller: { store: { name: string } | null }
  _count: { reviews: number }
}
type Service = {
  id: string
  name: string
  basePrice: number | null
  category: { name: string }
  seller: { store: { name: string } | null }
  _count: { reviews: number }
}

export function BrowseClient() {
  const searchParams = useSearchParams()
  const categoryId = searchParams.get("categoryId")
  const subcategoryId = searchParams.get("subcategoryId")
  const [sponsoredAds, setSponsoredAds] = useState<Ad[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set("categoryId", categoryId)
    if (subcategoryId) params.set("subcategoryId", subcategoryId)
    const qs = params.toString()
    fetch(`/api/customer/browse${qs ? `?${qs}` : ""}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { sponsoredAds?: Ad[]; products?: Product[]; services?: Service[] }) => {
        setSponsoredAds(data.sponsoredAds || [])
        setProducts(data.products || [])
        setServices(data.services || [])
      })
      .finally(() => setLoading(false))
  }, [categoryId, subcategoryId])

  if (loading) return <div className="container mx-auto p-6"><p className="text-muted-foreground">Loading...</p></div>

  return (
    <div className="container mx-auto p-6 space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Marketplace</h1>
        <p className="text-muted-foreground mt-2">Discover products and services from our sellers</p>
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
                          <iframe src={youtubeEmbed} title={ad.title} className="w-full h-full object-cover pointer-events-none" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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
                      <CardDescription>{ad.product ? ad.product.name : ad.service ? ad.service.name : "Ad"}</CardDescription>
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
            {products.map((product) => {
              const imageUrls = Array.isArray(product.images) ? product.images : (typeof product.images === "string" ? (() => { try { return JSON.parse(product.images as string) as string[] } catch { return [] } })() : [])
              const firstImage = imageUrls.length > 0 ? imageUrls[0] : null
              const finalPrice = Math.max(0, (product.basePrice ?? 0) - (product.discount ?? 0))
              return (
                <Link key={product.id} href={`/product/${product.id}`} className="group">
                  <Card className="hover:shadow-md transition-shadow h-full overflow-hidden border-0 bg-white shadow-md group-hover:shadow-lg">
                    <div className="relative aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                      {firstImage ? (
                        <img src={firstImage} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="h-14 w-14 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.seller?.store?.name ?? "Store"}</p>
                      <p className="mt-1 font-bold text-primary">{formatCurrency(finalPrice)}</p>
                      {product._count.reviews > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{product._count.reviews} review{product._count.reviews !== 1 ? "s" : ""}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
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
                      <Badge variant="outline" className="text-xs">{service.category.name}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {service.basePrice ? (
                      <p className="text-2xl font-bold mb-2">{formatCurrency(service.basePrice)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">Price on request</p>
                    )}
                    <p className="text-sm text-muted-foreground">{service.seller.store?.name || "Store"}</p>
                    {service._count.reviews > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{service._count.reviews} review{service._count.reviews !== 1 ? "s" : ""}</p>
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
