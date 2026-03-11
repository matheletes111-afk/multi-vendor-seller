"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";
import { Package, Briefcase, ShoppingBag } from "lucide-react";

type Banner = {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  categoryId: string | null;
  subcategoryId: string | null;
  serviceCategoryId: string | null;
};

type Product = {
  id: string;
  name: string;
  basePrice: number;
  discount?: number;
  images: string[] | unknown;
  category: { name: string };
  seller: { store: { name: string } | null };
  _count: { reviews: number };
};

type Service = {
  id: string;
  name: string;
  basePrice: number | null;
  images?: unknown;
  serviceCategory: { name: string };
  seller: { store: { name: string } | null };
  _count: { reviews: number };
};

function getServiceFirstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) return images[0] as string;
  if (typeof images === "string") try { const a = JSON.parse(images) as string[]; return a[0] ?? null; } catch { return null; }
  return null;
}

export function BannerPageClient() {
  const params = useParams();
  const bannerId = params?.bannerId as string | undefined;
  const [banner, setBanner] = useState<Banner | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!bannerId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetch(`/api/home/banners/${bannerId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data: Banner) => {
        if (cancelled) return;
        setBanner(data);
        const params = new URLSearchParams();
        if (data.serviceCategoryId) {
          params.set("serviceCategoryId", data.serviceCategoryId);
        } else {
          if (data.categoryId) params.set("categoryId", data.categoryId);
          if (data.subcategoryId) params.set("subcategoryId", data.subcategoryId);
        }
        const qs = params.toString();
        return fetch(`/api/customer/browse${qs ? `?${qs}` : ""}`);
      })
      .then((r) => (r && r.ok ? r.json() : { products: [], services: [] }))
      .then((data: { products?: Product[]; services?: Service[] }) => {
        if (cancelled) return;
        setProducts(data.products || []);
        setServices(data.services || []);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bannerId]);

  if (loading) return <PageLoader message="Loading…" />;

  if (notFound || !banner) {
    return (
      <div className="min-w-0 overflow-x-hidden">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Banner not found</h1>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm sm:text-base">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-x-hidden" style={{ background: "#fefefe" }}>
        {/* Banner hero - same placement/sizing as home page banner */}
        <section className="relative w-full max-w-[100vw] bg-muted overflow-hidden min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh]">
          <div className="relative w-full min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh] overflow-hidden">
            <div className="absolute inset-0">
              <img
                src={banner.bannerImage}
                alt={banner.bannerHeading}
                className="h-full w-full min-h-full min-w-full object-cover object-center"
                sizes="100vw"
                fetchPriority="high"
              />
              <div className="absolute inset-0 flex items-center justify-center px-4 drop-shadow-md">
                <h1 className="text-lg font-bold text-blue-100 max-w-4xl sm:text-xl md:text-2xl lg:text-3xl text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] leading-tight">
                  {banner.bannerHeading}
                </h1>
              </div>
            </div>
          </div>
        </section>

        {/* When banner is for a service category, show services first; otherwise products first */}
        {banner.serviceCategoryId ? (
        /* Services section (first for service-category banners) */
        <section className="container mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6 md:px-5 md:py-8">
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-800 sm:text-lg md:text-xl">
              Services in this category
            </h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {services.length} {services.length === 1 ? "service" : "services"}
            </span>
          </div>
          {services.length === 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="py-8 text-center sm:py-10 md:py-12 px-4">
                <p className="text-muted-foreground text-sm sm:text-base">No services in this category yet.</p>
                <Link href="/browse" className="mt-4 inline-block text-blue-600 hover:underline text-sm sm:text-base">
                  Browse all services
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => {
                const firstImg = getServiceFirstImage(service.images);
                return (
                <Link key={service.id} href={`/service/${service.id}`} className="block min-w-0">
                  <Card className="h-full overflow-hidden border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      {firstImg ? (
                        <img src={firstImg} alt={service.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Briefcase className="h-10 w-10 sm:h-12 sm:w-12" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base break-words">
                        {service.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] sm:text-xs">{service.serviceCategory.name}</span>
                      </p>
                      {service.basePrice != null ? (
                        <p className="mt-2 text-base font-bold text-primary sm:text-lg md:text-xl">
                          {formatCurrency(service.basePrice)}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Price on request</p>
                      )}
                      <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">
                        {service.seller?.store?.name ?? "Store"}
                      </p>
                      {service._count.reviews > 0 && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {service._count.reviews} review{service._count.reviews !== 1 ? "s" : ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ); })}
            </div>
          )}
        </section>
        ) : null}

        {/* Products – only when banner is for product (category/subcategory); no product section for service banners */}
        {!banner.serviceCategoryId && (
        <section className="container mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6 md:px-5 md:py-8 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-800 sm:text-lg md:text-xl">
              {banner.categoryId ? "Products in this category" : "Products"}
            </h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {products.length} {products.length === 1 ? "product" : "products"}
            </span>
          </div>

          {products.length === 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="py-8 text-center sm:py-10 md:py-12 px-4">
                <p className="text-muted-foreground text-sm sm:text-base">
                  No products in this category yet.
                </p>
                <Link href="/browse" className="mt-4 inline-block text-blue-600 hover:underline text-sm sm:text-base">
                  Browse all products
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const imageUrls = Array.isArray(product.images)
                  ? product.images
                  : typeof product.images === "string"
                    ? (() => {
                        try {
                          return JSON.parse(product.images as string) as string[];
                        } catch {
                          return [];
                        }
                      })()
                    : [];
                const firstImage = imageUrls.length > 0 ? imageUrls[0] : null;
                const finalPrice = Math.max(
                  0,
                  (product.basePrice ?? 0) - (product.discount ?? 0)
                );
                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="group min-w-0"
                  >
                    <Card className="h-full overflow-hidden border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md group-hover:shadow-lg">
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-slate-400 sm:h-10 sm:w-10 md:h-12 md:w-12" />
                        )}
                      </div>
                      <CardContent className="p-2 sm:p-3 min-w-0">
                        <p className="line-clamp-2 text-xs font-medium text-slate-900 sm:text-sm break-words">
                          {product.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {product.seller?.store?.name ?? "Store"}
                        </p>
                        <p className="mt-1 font-bold text-primary text-xs sm:text-sm">
                          {formatCurrency(finalPrice)}
                        </p>
                        {product._count.reviews > 0 && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                            {product._count.reviews} review
                            {product._count.reviews !== 1 ? "s" : ""}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        )}
      </div>
  );
}
