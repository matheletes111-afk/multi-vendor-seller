"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { Package, Briefcase, ShoppingBag, ChevronRight } from "lucide-react"

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
  images?: unknown
  category: { name: string }
  seller: { store: { name: string } | null }
  _count: { reviews: number }
}

function getServiceFirstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) return images[0] as string
  if (typeof images === "string") try { const a = JSON.parse(images) as string[]; return a[0] ?? null } catch { return null }
  return null
}
type Subcategory = { id: string; name: string; slug: string }

export function BrowseClient() {
  const searchParams = useSearchParams()
  const categoryId = searchParams.get("categoryId")
  const subcategoryId = searchParams.get("subcategoryId")
  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [categoryName, setCategoryName] = useState<string | null>(null)
  const [subcategoryName, setSubcategoryName] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [resolvedCategoryId, setResolvedCategoryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set("categoryId", categoryId)
    if (subcategoryId) params.set("subcategoryId", subcategoryId)
    const qs = params.toString()
    fetch(`/api/customer/browse${qs ? `?${qs}` : ""}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: {
        products?: Product[]
        services?: Service[]
        categoryName?: string | null
        subcategoryName?: string | null
        subcategories?: Subcategory[]
        resolvedCategoryId?: string | null
      }) => {
        setProducts(data.products || [])
        setServices(data.services || [])
        setCategoryName(data.categoryName ?? null)
        setSubcategoryName(data.subcategoryName ?? null)
        setSubcategories(data.subcategories || [])
        setResolvedCategoryId(data.resolvedCategoryId ?? null)
      })
      .finally(() => setLoading(false))
  }, [categoryId, subcategoryId])

  if (loading) return <PageLoader variant="listing" message="Loading products…" />

  const pageTitle = subcategoryName ?? categoryName ?? "Browse Marketplace"
  const isCategoryView = !!categoryId && !subcategoryId
  const isSubcategoryView = !!subcategoryId

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="container mx-auto w-full max-w-7xl px-3 py-5 space-y-6 sm:px-4 sm:py-6 sm:space-y-8 md:px-5 md:py-8 md:space-y-10">
        {/* Breadcrumb when filtering */}
        {(categoryName || subcategoryName) && (
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/browse" className="hover:text-foreground hover:underline">Browse</Link>
            {categoryName && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0" />
                {isSubcategoryView && resolvedCategoryId ? (
                  <Link href={`/browse?categoryId=${resolvedCategoryId}`} className="hover:text-foreground hover:underline">{categoryName}</Link>
                ) : (
                  <span className="font-medium text-foreground">{categoryName}</span>
                )}
              </>
            )}
            {subcategoryName && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="font-medium text-foreground">{subcategoryName}</span>
              </>
            )}
          </nav>
        )}

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:mt-2 sm:text-base">
            {isSubcategoryView ? `Products in ${subcategoryName}` : categoryName ? `Products in ${categoryName}` : "Discover products and services from our sellers"}
          </p>
        </div>

        {/* Subcategories: only when viewing a category (not subcategory) and API returned subcategories */}
        {isCategoryView && subcategories.length > 0 && (
          <section>
            <h2 className="sr-only">Subcategories</h2>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/browse?subcategoryId=${sub.id}`}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 shrink-0" />
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">Products</h2>
            <Badge variant="secondary" className="text-xs">{products.length}</Badge>
          </div>
          {products.length === 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="py-8 text-center sm:py-10 md:py-12 px-4">
                <p className="text-muted-foreground text-sm sm:text-base">No products available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const imageUrls = Array.isArray(product.images) ? product.images : (typeof product.images === "string" ? (() => { try { return JSON.parse(product.images as string) as string[] } catch { return [] } })() : [])
                const firstImage = imageUrls.length > 0 ? imageUrls[0] : null
                const finalPrice = Math.max(0, (product.basePrice ?? 0) - (product.discount ?? 0))
                return (
                  <Link key={product.id} href={`/product/${product.id}`} className="group min-w-0">
                    <Card className="hover:shadow-md transition-shadow h-full overflow-hidden border border-slate-200 bg-white shadow-sm group-hover:shadow-lg">
                      <div className="relative aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                        {firstImage ? (
                          <img src={firstImage} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-muted-foreground sm:h-10 sm:w-10 md:h-12 md:w-12" />
                        )}
                      </div>
                      <CardContent className="p-2 sm:p-3 min-w-0">
                        <p className="line-clamp-2 text-xs font-medium sm:text-sm text-slate-900 break-words">{product.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{product.seller?.store?.name ?? "Store"}</p>
                        <p className="mt-1 font-bold text-primary text-xs sm:text-sm">{formatCurrency(finalPrice)}</p>
                        {product._count.reviews > 0 && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{product._count.reviews} review{product._count.reviews !== 1 ? "s" : ""}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Services: show on all pages (category, subcategory, and plain browse) when any exist */}
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 shrink-0" />
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">Services</h2>
            <Badge variant="secondary" className="text-xs">{services.length}</Badge>
          </div>
          {services.length === 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="py-8 text-center sm:py-10 md:py-12 px-4">
                <p className="text-muted-foreground text-sm sm:text-base">No services available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => {
                const firstImg = getServiceFirstImage(service.images)
                return (
                <Link key={service.id} href={`/service/${service.id}`} className="block min-w-0">
                  <Card className="hover:shadow-md transition-shadow h-full overflow-hidden">
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {firstImg ? (
                        <img src={firstImg} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Briefcase className="h-10 w-10 sm:h-12 sm:w-12" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-3 sm:p-4 md:p-6">
                      <CardTitle className="line-clamp-2 text-base sm:text-lg">{service.name}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline" className="text-xs">{service.category.name}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                      {service.basePrice ? (
                        <p className="text-lg font-bold mb-2 sm:text-xl md:text-2xl">{formatCurrency(service.basePrice)}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground mb-2">Price on request</p>
                      )}
                      <p className="text-sm text-muted-foreground">{service.seller?.store?.name || "Store"}</p>
                      {service._count.reviews > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{service._count.reviews} review{service._count.reviews !== 1 ? "s" : ""}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )})}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
