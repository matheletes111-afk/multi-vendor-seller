"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Folder,
  LayoutGrid,
  Tag,
  BookOpen,
  Briefcase,
  Dumbbell,
  Music,
  ShoppingBag,
  Box,
  Gift,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { PageLoader } from "@/components/ui/page-loader";

const SUB_PLACEHOLDER_ICONS = [Package, Folder, LayoutGrid, Tag, BookOpen, Briefcase, Dumbbell, Music];
const PRODUCT_PLACEHOLDER_ICONS = [ShoppingBag, Box, Package, Gift, Sparkles, Tag];
import { PublicLayout } from "@/components/site-layout";

type Banner = {
  id: string;
  bannerHeading: string;
  bannerDescription: string | null;
  bannerImage: string;
  categoryId: string | null;
  subcategoryId: string | null;
};

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  subcategories: Subcategory[];
};

type Product = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  discount: number;
  images: string[];
  category: { id: string; name: string; slug: string };
  seller: { store: { name: string } | null };
};

type Ad = {
  id: string;
  title: string;
  creativeType: string;
  creativeUrl: string;
  productId: string | null;
  serviceId: string | null;
};

export function HomeClient() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, Product[]>>({});
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [ads, setAds] = useState<Ad[]>([]);
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false);
  const [sponsoredIndex, setSponsoredIndex] = useState(0);
  const sponsoredScrollRef = useRef<HTMLDivElement>(null);
  const bestSellersRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch("/api/home/banners")
      .then((r) => r.json())
      .then(setBanners)
      .catch(() => setBanners([]));
  }, []);

  useEffect(() => {
    setCategoriesLoading(true);
    fetch("/api/home/categories")
      .then((r) => r.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesLoading(false);
      })
      .catch(() => {
        setCategories([]);
        setCategoriesLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/home/products")
      .then((r) => r.json())
      .then(setRandomProducts)
      .catch(() => setRandomProducts([]));
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    const latest = categories.slice(0, 4);
    latest.forEach((cat) => {
      fetch(`/api/home/products?categoryId=${cat.id}&limit=10`)
        .then((r) => r.json())
        .then((list: Product[]) => {
          setProductsByCategory((prev) => ({ ...prev, [cat.id]: list }));
        })
        .catch(() => {});
    });
  }, [categories]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    fetch("/api/home/ads")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setAds(data) : setAds([])))
      .catch(() => setAds([]));
  }, []);

  // Sponsored carousel: auto-advance to next slide; pause when user clicks an ad/video
  useEffect(() => {
    if (ads.length <= 1 || sponsoredCarouselPaused) return;
    const t = setInterval(() => {
      setSponsoredIndex((i) => (i + 1) % ads.length);
    }, 5000);
    return () => clearInterval(t);
  }, [ads.length, sponsoredCarouselPaused]);

  // Scroll sponsored carousel to active index
  useEffect(() => {
    const el = sponsoredScrollRef.current;
    if (!el || ads.length === 0) return;
    const card = el.querySelector("[data-sponsored-card]");
    const gap = 16;
    const cardWidth = (card?.getBoundingClientRect().width ?? 280) + gap;
    el.scrollLeft = Math.min(sponsoredIndex * cardWidth, el.scrollWidth - el.clientWidth);
  }, [sponsoredIndex, ads.length]);

  // Sync sponsored index when user scrolls (arrows or swipe)
  useEffect(() => {
    const el = sponsoredScrollRef.current;
    if (!el || ads.length <= 1) return;
    const onScroll = () => {
      const card = el.querySelector("[data-sponsored-card]");
      const gap = 16;
      const cardWidth = (card?.getBoundingClientRect().width ?? 280) + gap;
      const index = Math.round(el.scrollLeft / cardWidth);
      setSponsoredIndex(Math.min(index, ads.length - 1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ads.length]);

  const latestCategories = categories.slice(0, 4);

  return (
    <PublicLayout>
      <div className="flex-1" style={{ background: "#fefefe" }}>
        {categoriesLoading ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <PageLoader message="Loading…" />
          </div>
        ) : (
        <>
        {/* Full-width hero: banner or placeholder so cards sit "above" it */}
        <section className="relative w-full max-w-[100vw] bg-muted overflow-hidden min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh]">
          {banners.length > 0 ? (
            <>
            <div className="relative w-full min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh] overflow-hidden">
              {banners.map((banner, i) => (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    i === bannerIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <Link
                    href={
                      banner.categoryId
                        ? `/browse?categoryId=${banner.categoryId}${banner.subcategoryId ? `&subcategoryId=${banner.subcategoryId}` : ""}`
                        : "/browse"
                    }
                    className="block size-full"
                  >
                    <img
                      src={banner.bannerImage}
                      alt={banner.bannerHeading}
                      className="h-full w-full min-h-full min-w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 flex items-center justify-center px-4 drop-shadow-md">
                      <h2 className="text-lg font-bold text-blue-100 sm:text-xl md:text-2xl lg:text-3xl text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{banner.bannerHeading}</h2>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-1 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full shadow-md sm:left-2 sm:h-10 sm:w-10"
                  onClick={() => setBannerIndex((i) => (i - 1 + banners.length) % banners.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full shadow-md sm:right-2 sm:h-10 sm:w-10"
                  onClick={() => setBannerIndex((i) => (i + 1) % banners.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
            </>
          ) : null}
        </section>

        {/* Category cards above banner - inherit page gradient (no extra background strip) */}
        <section className="container mx-auto px-3 sm:px-4 -mt-[18vh] sm:-mt-[22vh] md:-mt-[24vh] relative z-10 pb-6 sm:pb-8 min-h-[180px] sm:min-h-[200px] flex items-center justify-center">
          {latestCategories.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 w-full max-w-6xl mx-auto">
              {latestCategories.map((cat) => (
                <Card key={cat.id} className="overflow-hidden border-0 bg-white shadow-lg transition-shadow hover:shadow-xl">
                  <CardContent className="p-4 flex flex-col">
                    <h3 className="mb-3 font-bold text-slate-900 text-base">{cat.name}</h3>
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      {cat.subcategories.slice(0, 4).map((sub, subIdx) => {
                        const SubIcon = SUB_PLACEHOLDER_ICONS[subIdx % SUB_PLACEHOLDER_ICONS.length];
                        return (
                          <Link
                            key={sub.id}
                            href={`/browse?subcategoryId=${sub.id}`}
                            className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2 transition-colors hover:bg-slate-100"
                          >
                            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted flex items-center justify-center">
                              {sub.image ? (
                                <img src={sub.image} alt={sub.name} className="h-full w-full object-cover" />
                              ) : (
                                <SubIcon className="h-8 w-8 text-slate-400" />
                              )}
                            </div>
                            <span className="mt-1 text-center text-xs font-medium text-slate-700 line-clamp-2">{sub.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <Link
                      href={`/browse?categoryId=${cat.id}`}
                      className="mt-3 block text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Shop {cat.name}
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </section>

        {/* Best Sellers: horizontal carousels with arrows (no scrollbar) */}
        {latestCategories.filter((c) => (productsByCategory[c.id]?.length ?? 0) > 0).length > 0 && (
          <section className="border-t border-blue-100 bg-white/70 py-6 sm:py-8">
            <div className="container mx-auto space-y-6 sm:space-y-8 px-3 sm:px-4">
              {latestCategories.slice(0, 2).map((cat) => {
                const products = productsByCategory[cat.id] ?? [];
                if (products.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h2 className="mb-3 sm:mb-4 text-lg font-bold text-slate-800 sm:text-xl">
                      Best Sellers in {cat.name}
                    </h2>
                    <div className="relative">
                      {products.length > 1 && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute left-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:-left-3 sm:h-9 sm:w-9"
                            onClick={() => {
                              const el = bestSellersRefs.current[cat.id];
                              if (!el) return;
                              const card = el.querySelector("[data-best-seller-card]") as HTMLElement | null;
                              const gap = 12;
                              const cardWidth = (card?.getBoundingClientRect().width ?? 160) + gap;
                              el.scrollLeft = Math.max(0, el.scrollLeft - cardWidth);
                            }}
                            aria-label={`Previous best sellers in ${cat.name}`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:-right-3 sm:h-9 sm:w-9"
                            onClick={() => {
                              const el = bestSellersRefs.current[cat.id];
                              if (!el) return;
                              const card = el.querySelector("[data-best-seller-card]") as HTMLElement | null;
                              const gap = 12;
                              const cardWidth = (card?.getBoundingClientRect().width ?? 160) + gap;
                              el.scrollLeft = Math.min(
                                el.scrollWidth - el.clientWidth,
                                el.scrollLeft + cardWidth
                              );
                            }}
                            aria-label={`Next best sellers in ${cat.name}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <div
                        ref={(el) => {
                          if (el) bestSellersRefs.current[cat.id] = el;
                        }}
                        className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden py-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {products.map((p, pIdx) => {
                          const ProductIcon = PRODUCT_PLACEHOLDER_ICONS[pIdx % PRODUCT_PLACEHOLDER_ICONS.length];
                          return (
                            <Link
                              key={p.id}
                              href={`/product/${p.id}`}
                              data-best-seller-card
                              className="flex w-32 shrink-0 snap-start flex-col overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-lg sm:w-40"
                            >
                              <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
                                {p.images[0] ? (
                                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ProductIcon className="h-12 w-12 text-slate-400" />
                                )}
                              </div>
                              <div className="p-2">
                                <p className="line-clamp-2 text-xs font-medium text-slate-800">{p.name}</p>
                                <p className="mt-1 text-sm font-bold text-blue-600">
                                  {formatCurrency(Math.max(0, p.basePrice - p.discount))}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sponsored ads - auto carousel left to right; pause when user clicks an ad/video */}
        {ads.length > 0 && (
          <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
            <div className="mb-4 sm:mb-6 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Sponsored</h2>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {ads.length} {ads.length === 1 ? "ad" : "ads"}
              </span>
              {sponsoredCarouselPaused && (
                <span className="text-xs text-slate-500">(paused)</span>
              )}
            </div>
            <div className="relative">
              {/* Carousel arrows */}
              {ads.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:left-2 sm:h-9 sm:w-9"
                    onClick={() => {
                      setSponsoredCarouselPaused(true);
                      setSponsoredIndex((i) => (i <= 0 ? ads.length - 1 : i - 1));
                    }}
                    aria-label="Previous ad"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:right-2 sm:h-9 sm:w-9"
                    onClick={() => {
                      setSponsoredCarouselPaused(true);
                      setSponsoredIndex((i) => (i >= ads.length - 1 ? 0 : i + 1));
                    }}
                    aria-label="Next ad"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <div
                ref={sponsoredScrollRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden scroll-smooth py-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollBehavior: sponsoredCarouselPaused ? "auto" : "smooth" }}
              >
              {ads.map((ad) => {
                const adHref = ad.productId ? `/product/${ad.productId}` : ad.serviceId ? `/service/${ad.serviceId}` : "/browse";
                const isVideo = ad.creativeType === "VIDEO";
                const youtubeEmbed = isVideo ? getYoutubeEmbedUrl(ad.creativeUrl) : null;
                return (
                  <div
                    key={ad.id}
                    data-sponsored-card
                    onClick={() => setSponsoredCarouselPaused(true)}
                    className="group flex w-[85vw] min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg sm:min-w-[280px] md:min-w-[300px]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      {isVideo ? (
                        youtubeEmbed ? (
                          <iframe
                            src={youtubeEmbed}
                            title={ad.title}
                            className="h-full w-full object-cover pointer-events-auto"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={ad.creativeUrl}
                            className="h-full w-full object-cover"
                            controls
                            muted
                            playsInline
                            preload="metadata"
                          >
                            Your browser does not support the video tag.
                          </video>
                        )
                      ) : (
                        <Link href={adHref} className="block h-full w-full">
                          <img
                            src={ad.creativeUrl}
                            alt={ad.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          />
                        </Link>
                      )}
                      <div className="absolute bottom-2 left-2 pointer-events-none">
                        <span className="rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                          Sponsored
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <Link
                        href={adHref}
                        className="font-semibold text-slate-900 line-clamp-2 hover:text-blue-600 hover:underline text-sm sm:text-base"
                      >
                        {ad.title}
                      </Link>
                      <Link
                        href={adHref}
                        className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:underline"
                      >
                        View details →
                      </Link>
                    </div>
                  </div>
                );
              })}
              </div>
              {/* Pagination dots */}
              {ads.length > 1 && (
                <div className="mt-4 flex justify-center gap-1.5">
                  {ads.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to ad ${i + 1}`}
                      onClick={() => {
                        setSponsoredCarouselPaused(true);
                        setSponsoredIndex(i);
                      }}
                      className={`h-1.5 w-6 rounded-full transition-colors hover:bg-slate-400 ${
                        i === sponsoredIndex ? "bg-slate-700" : "bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Explore products: Amazon-style grid */}
        {randomProducts.length > 0 && (
          <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
            <h2 className="mb-4 sm:mb-6 text-lg font-bold text-slate-800 sm:text-xl">Explore products</h2>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {randomProducts.slice(0, 8).map((p, pIdx) => {
                const ProductIcon = PRODUCT_PLACEHOLDER_ICONS[pIdx % PRODUCT_PLACEHOLDER_ICONS.length];
                return (
                <Link key={p.id} href={`/product/${p.id}`} className="group">
                  <Card className="h-full overflow-hidden border-0 bg-white shadow-md transition-shadow group-hover:shadow-lg">
                    <div className="relative aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ProductIcon className="h-14 w-14 text-slate-400" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.seller?.store?.name ?? "Store"}</p>
                      <p className="mt-1 font-bold text-blue-600">{formatCurrency(Math.max(0, p.basePrice - p.discount))}</p>
                    </CardContent>
                  </Card>
                </Link>
              );})}
            </div>
            <div className="mt-6 text-center">
              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
                <Link href="/browse">View all products</Link>
              </Button>
            </div>
          </section>
        )}

        </>
        )}
      </div>
    </PublicLayout>
  );
}
