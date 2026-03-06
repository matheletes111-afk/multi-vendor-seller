"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { PageLoader } from "@/components/ui/page-loader";
import { Briefcase, ShoppingBag } from "lucide-react";

type Ad = {
  id: string;
  title: string;
  creativeType: string;
  creativeUrl: string;
  productId: string | null;
  serviceId: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    images: unknown;
    category: { name: string };
    seller: { store: { name: string } | null };
    _count: { reviews: number };
    basePrice: number;
    discount: number;
  } | null;
  service: {
    id: string;
    name: string;
    slug: string;
    basePrice: number | null;
    images?: unknown;
    category: { name: string };
    seller: { store: { name: string } | null };
    _count: { reviews: number };
  } | null;
};

export function AdPageClient() {
  const params = useParams();
  const adId = params?.adId as string | undefined;
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!adId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/home/ads/${adId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data: Ad) => {
        if (!cancelled) setAd(data);
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
  }, [adId]);

  if (loading) return <PageLoader message="Loading…" />;

  if (notFound || !ad) {
    return (
      <div className="min-w-0 overflow-x-hidden">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Ad not found</h1>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm sm:text-base">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const isVideo = ad.creativeType === "VIDEO";
  const youtubeEmbed = isVideo ? getYoutubeEmbedUrl(ad.creativeUrl) : null;

  return (
    <div className="flex-1 min-w-0 overflow-x-hidden" style={{ background: "#fefefe" }}>
      {/* Ad as banner - same look as home page banner section */}
      <section className="relative w-full max-w-[100vw] bg-muted overflow-hidden min-h-[35vh] sm:min-h-[50vh] md:min-h-[60vh] lg:min-h-[70vh]">
        <div className="relative w-full h-full min-h-[35vh] sm:min-h-[50vh] md:min-h-[60vh] lg:min-h-[70vh] overflow-hidden">
          <div className="absolute inset-0">
            {isVideo ? (
              youtubeEmbed ? (
                <iframe
                  src={youtubeEmbed}
                  title={ad.title}
                  className="h-full w-full min-h-full min-w-full object-cover object-center"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video
                  src={ad.creativeUrl}
                  className="h-full w-full min-h-full min-w-full object-cover object-center"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              )
            ) : (
              <img
                src={ad.creativeUrl}
                alt={ad.title}
                className="h-full w-full min-h-full min-w-full object-cover object-center"
                sizes="100vw"
                fetchPriority="high"
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 sm:px-4 md:px-6 py-6 drop-shadow-md">
              <h1 className="text-base font-bold text-blue-100 max-w-4xl sm:text-lg md:text-xl lg:text-2xl xl:text-3xl text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] leading-tight">
                {ad.title}
              </h1>
            </div>
            <div className="pointer-events-none absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
              <span className="rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white sm:text-sm">
                Sponsored
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Connected product and service */}
      <div className="container mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6 md:px-5 md:py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 sm:text-xl md:text-2xl">Related to this ad</h2>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl">
          {ad.product && (
            <Link href={`/product/${ad.product.id}`} className="group min-w-0">
              <Card className="h-full overflow-hidden border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md group-hover:shadow-lg">
                <div className="flex flex-col sm:flex-row">
                  <div className="relative aspect-square w-full sm:w-40 sm:aspect-auto sm:min-h-[140px] overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                    {(() => {
                      const images = Array.isArray(ad.product.images)
                        ? ad.product.images
                        : typeof ad.product.images === "string"
                          ? (() => {
                              try {
                                return JSON.parse(ad.product.images as string) as string[];
                              } catch {
                                return [];
                              }
                            })()
                          : [];
                      const firstImage = images.length > 0 ? images[0] : null;
                      return firstImage ? (
                        <img
                          src={firstImage}
                          alt={ad.product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-slate-400 sm:h-12 sm:w-12" />
                      );
                    })()}
                  </div>
                  <CardContent className="p-3 sm:p-4 flex-1 min-w-0 flex flex-col justify-center">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base break-words">
                      {ad.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ad.product.seller?.store?.name ?? "Store"}
                    </p>
                    <p className="mt-2 font-bold text-primary text-sm sm:text-base">
                      {formatCurrency(Math.max(0, ad.product.basePrice - ad.product.discount))}
                    </p>
                    {ad.product._count.reviews > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ad.product._count.reviews} review{ad.product._count.reviews !== 1 ? "s" : ""}
                      </p>
                    )}
                    <span className="mt-2 inline-flex text-sm font-medium text-blue-600 group-hover:underline">
                      View product →
                    </span>
                  </CardContent>
                </div>
              </Card>
            </Link>
          )}
          {ad.service && (() => {
            const imgs = ad.service.images;
            const firstImg = Array.isArray(imgs) && imgs.length > 0 ? (imgs[0] as string) : typeof imgs === "string" ? (() => { try { const a = JSON.parse(imgs) as string[]; return a[0] ?? null; } catch { return null; } })() : null;
            return (
            <Link href={`/service/${ad.service!.id}`} className="group min-w-0 block">
              <Card className="h-full overflow-hidden border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md group-hover:shadow-lg">
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                  {firstImg ? (
                    <img src={firstImg} alt={ad.service!.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Briefcase className="h-10 w-10 sm:h-12 sm:w-12" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3 sm:p-4 flex flex-col justify-center min-h-[100px]">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base break-words">
                    {ad.service.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="rounded border border-slate-200 px-1.5 py-0.5">{ad.service.category.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ad.service.seller?.store?.name ?? "Store"}
                  </p>
                  {ad.service.basePrice != null ? (
                    <p className="mt-2 font-bold text-primary text-sm sm:text-base">
                      {formatCurrency(ad.service.basePrice)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Price on request</p>
                  )}
                  {ad.service._count.reviews > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ad.service._count.reviews} review{ad.service._count.reviews !== 1 ? "s" : ""}
                    </p>
                  )}
                  <span className="mt-2 inline-flex text-sm font-medium text-blue-600 group-hover:underline">
                    View service →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );})()}
        </div>
        {!ad.product && !ad.service && (
          <Card className="overflow-hidden">
            <CardContent className="py-8 text-center sm:py-10 px-4">
              <p className="text-muted-foreground text-sm sm:text-base">No linked product or service.</p>
              <Link href="/browse" className="mt-4 inline-block text-blue-600 hover:underline text-sm sm:text-base">
                Browse marketplace
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
