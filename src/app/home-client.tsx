"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
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
  Eye,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getYoutubeEmbedUrl, getYoutubeThumbnailUrl } from "@/lib/youtube";
import { PageLoader } from "@/components/ui/page-loader";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { WishlistButton } from "@/components/product/WishlistButton";

const SUB_PLACEHOLDER_ICONS = [Package, Folder, LayoutGrid, Tag, BookOpen, Briefcase, Dumbbell, Music];
const PRODUCT_PLACEHOLDER_ICONS = [ShoppingBag, Box, Package, Gift, Sparkles, Tag];
const SERVICE_PLACEHOLDER_ICONS = [Briefcase, Sparkles, Tag, Music, Dumbbell, Folder];
import { PublicLayout } from "@/components/site-layout";
import { PublicReviewsSection, StarRow } from "@/components/reviews/public-reviews-section";
import {
  CategoryInterestModal,
  type CategoryPickItem,
} from "@/components/customer/category-interest-modal";

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
  mobileIcon?: string | null;
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
  _count?: { reviews: number };
  averageRating?: number;
};

type Service = {
  id: string;
  name: string;
  basePrice: number | null;
  discount: number;
  images: unknown;
  serviceCategory: { id: string; name: string; slug: string } | null;
  seller: { store: { name: string } | null } | null;
  _count?: { reviews: number };
  averageRating?: number;
};

type Ad = {
  id: string;
  title: string;
  description: string | null;
  creativeType: string;
  creativeUrl: string;
  productId: string | null;
  serviceId: string | null;
};

export function HomeClient() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, Product[]>>({});
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [homeServices, setHomeServices] = useState<Service[]>([]);
  const [recentViewProducts, setRecentViewProducts] = useState<Product[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const { data: session, status } = useSession();
  const [ads, setAds] = useState<Ad[]>([]);
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false);
  const [sponsoredIndex, setSponsoredIndex] = useState(0);
  const sponsoredScrollRef = useRef<HTMLDivElement>(null);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestPickerCategories, setInterestPickerCategories] = useState<CategoryPickItem[]>([]);
  const [interestInitialIds, setInterestInitialIds] = useState<string[]>([]);
  /** True when the customer has saved at least one category interest (drives “For you” label). */
  const [hasCategoryInterests, setHasCategoryInterests] = useState(false);
  const bestSellersRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const serviceCarouselRef = useRef<HTMLDivElement>(null);
  // Mobile icon only on mobile; on web use main image only
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    fetch("/api/home/banners")
      .then((r) => r.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          const homeBanners = data.filter((b) => b.targetType !== "restaurant" && b.targetType !== "hotel");
          setBanners(homeBanners);
        } else {
          setBanners([]);
        }
      })
      .catch(() => setBanners([]));
  }, []);

  useEffect(() => {
    setCategoriesLoading(true);
    Promise.all([
      fetch("/api/home/categories").then((r) => r.json()),
      fetch("/api/home/categories/featured").then((r) => r.json()),
    ])
      .then(([all, featured]) => {
        setCategories(Array.isArray(all) ? all : []);
        setFeaturedCategories(Array.isArray(featured) ? featured : []);
        setCategoriesLoading(false);
      })
      .catch(() => {
        setCategories([]);
        setFeaturedCategories([]);
        setCategoriesLoading(false);
      });
  }, []);

  const refreshHomeProducts = useCallback(() => {
    fetch("/api/home/products", { credentials: "include" })
      .then((r) => r.json())
      .then((data: unknown) => {
        setRandomProducts(Array.isArray(data) ? (data as Product[]) : []);
      })
      .catch(() => setRandomProducts([]));
  }, []);

  useEffect(() => {
    refreshHomeProducts();
  }, [refreshHomeProducts, status, session?.user?.id, session?.user?.role]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== UserRole.CUSTOMER) {
      setInterestModalOpen(false);
      setInterestPickerCategories([]);
      setInterestInitialIds([]);
      setHasCategoryInterests(false);
      return;
    }
    let cancelled = false;
    fetch("/api/customer/category-interests", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { needsPrompt?: boolean; categories?: CategoryPickItem[]; selectedIds?: string[] } | null) => {
        if (cancelled || !data) return;
        const selected = Array.isArray(data.selectedIds) ? data.selectedIds : [];
        setHasCategoryInterests(selected.length > 0);
        if (data.needsPrompt && Array.isArray(data.categories) && data.categories.length > 0) {
          setInterestPickerCategories(data.categories);
          setInterestInitialIds(selected);
          setInterestModalOpen(true);
        } else {
          setInterestModalOpen(false);
        }
      })
      .catch(() => {
        if (!cancelled) setInterestModalOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.role, session?.user?.id]);

  useEffect(() => {
    fetch("/api/home/services?limit=12")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Service[]) => setHomeServices(Array.isArray(data) ? data : []))
      .catch(() => setHomeServices([]));
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== UserRole.CUSTOMER) {
      setRecentViewProducts([]);
      return;
    }
    fetch("/api/customer/recent-views")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data: { products?: Product[] }) => setRecentViewProducts(Array.isArray(data?.products) ? data.products : []))
      .catch(() => setRecentViewProducts([]));
  }, [status, session?.user?.role]);

  useEffect(() => {
    const forProducts = featuredCategories.length > 0 ? featuredCategories : categories.slice(0, 4);
    if (forProducts.length === 0) return;
    forProducts.forEach((cat) => {
      fetch(`/api/home/products?categoryId=${cat.id}&limit=10`)
        .then((r) => r.json())
        .then((list: unknown) => {
          const rows = Array.isArray(list) ? (list as Product[]) : [];
          setProductsByCategory((prev) => ({ ...prev, [cat.id]: rows }));
        })
        .catch(() => {});
    });
  }, [categories, featuredCategories]);

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

  // Sponsored carousel: auto-advance right-to-left every 3s; loops from last ad back to first
  useEffect(() => {
    if (ads.length <= 1 || sponsoredCarouselPaused) return;
    const t = setInterval(() => {
      setSponsoredIndex((i) => (i + 1) % ads.length);
    }, 3000);
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

  // Mobile: show up to 4 featured categories; desktop: same or first 4 of all
  const latestCategories =
    featuredCategories.length > 0 ? featuredCategories : categories.slice(0, 4);

  const serviceFirstImage = (images: unknown): string | null => {
    if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0];
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images) as string[];
        return Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed[0] : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const exploreProductsPreview = randomProducts.slice(0, 8);

  const onInterestModalCompleted = useCallback(() => {
    setInterestModalOpen(false);
    fetch("/api/customer/category-interests", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { selectedIds?: string[] } | null) => {
        const selected = Array.isArray(data?.selectedIds) ? data.selectedIds : [];
        setHasCategoryInterests(selected.length > 0);
      })
      .catch(() => {});
    refreshHomeProducts();
  }, [refreshHomeProducts]);

  return (
    <PublicLayout>
      <CategoryInterestModal
        open={interestModalOpen}
        categories={interestPickerCategories}
        initialSelectedIds={interestInitialIds}
        onCompleted={onInterestModalCompleted}
      />
      <div className="flex-1" style={{ background: "#fefefe" }}>
        {categoriesLoading ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <PageLoader message="Loading…" />
          </div>
        ) : (
        <>
        {/* Full-width hero: banner with category cards overlapping from above */}
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
                    href={`/banner/${banner.id}`}
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

        {/* Category cards above banner (overlap); slightly less overlap so banner top stays visible */}
        <section className="container mx-auto px-3 sm:px-4 -mt-[15vh] sm:-mt-[19vh] md:-mt-[21vh] relative z-10 pb-6 sm:pb-8 min-h-[180px] sm:min-h-[200px] flex items-center justify-center">
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
                              {(() => {
                                const src = isMobileViewport && sub.mobileIcon ? sub.mobileIcon : sub.image;
                                return src ? (
                                  <img src={src} alt={sub.name} className="h-full w-full object-cover" />
                                ) : (
                                  <SubIcon className="h-8 w-8 text-slate-400" />
                                );
                              })()}
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

        {/* Recent views: only for logged-in customers, max 10 */}
        {recentViewProducts.length > 0 && (
          <section className="border-t border-blue-100 bg-white/70 py-6 sm:py-8">
            <div className="container mx-auto px-3 sm:px-4">
              <h2 className="mb-3 sm:mb-4 text-lg font-bold text-slate-800 sm:text-xl flex items-center gap-2">
                <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600" />
                Recently viewed
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
                {recentViewProducts.map((p, pIdx) => {
                  const ProductIcon = PRODUCT_PLACEHOLDER_ICONS[pIdx % PRODUCT_PLACEHOLDER_ICONS.length];
                  return (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="flex flex-col overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-lg"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
                        <div className="absolute right-2 top-2 z-10">
                          <WishlistButton productId={p.id} />
                        </div>
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ProductIcon className="h-12 w-12 text-slate-400" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-2 text-xs font-medium text-slate-800">{p.name}</p>
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <p className="text-sm font-bold text-blue-600">
                            {formatCurrency(Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0)))}
                          </p>
                          {(p._count?.reviews ?? 0) > 0 && (
                            <div className="flex items-center gap-1">
                              <StarRow rating={p.averageRating ?? 0} size="h-3 w-3" />
                              <span className="text-[10px] font-medium text-slate-600">{(p.averageRating ?? 0).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Best Sellers: horizontal carousels with arrows (no scrollbar) */}
        {latestCategories.filter((c) => (productsByCategory[c.id]?.length ?? 0) > 0).length > 0 && (
          <section className="border-t border-blue-100 bg-white/70 py-6 sm:py-8">
            <div className="container mx-auto px-3 sm:px-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                {latestCategories.slice(0, 2).map((cat) => {
                  const products = productsByCategory[cat.id] ?? []
                  if (products.length === 0) return null
                  return (
                    <div key={cat.id} className="min-w-0">
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
                                <div className="absolute right-2 top-2 z-10">
                                  <WishlistButton productId={p.id} />
                                </div>
                                {p.images[0] ? (
                                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ProductIcon className="h-12 w-12 text-slate-400" />
                                )}
                              </div>
                              <div className="p-2">
                                <p className="line-clamp-2 text-xs font-medium text-slate-800">{p.name}</p>
                                <div className="flex items-center justify-between gap-1 mt-1">
                                  <p className="text-sm font-bold text-blue-600">
                                    {formatCurrency(Math.max(0, p.basePrice - p.discount))}
                                  </p>
                                  {(p._count?.reviews ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <StarRow rating={p.averageRating ?? 0} size="h-3 w-3" />
                                      <span className="text-[10px] font-medium text-slate-600">{(p.averageRating ?? 0).toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  )
                })}
              </div>
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
                const adPageHref = `/api/ads/click?adId=${ad.id}&redirect_to_ad=true`;
                const isVideo = ad.creativeType === "VIDEO";
                const youtubeEmbed = isVideo ? getYoutubeEmbedUrl(ad.creativeUrl) : null;
                const displayImage = getYoutubeThumbnailUrl(ad.creativeUrl) || ad.creativeUrl;
                return (
                  <Link
                    key={ad.id}
                    href={adPageHref}
                    data-sponsored-card
                    onClick={() => setSponsoredCarouselPaused(true)}
                    className="group flex w-[85vw] min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg sm:min-w-[280px] md:min-w-[300px]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={ad.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      ) : isVideo && youtubeEmbed ? (
                        <iframe
                          src={youtubeEmbed}
                          title={ad.title}
                          className="h-full w-full object-cover pointer-events-none"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      ) : isVideo ? (
                        <video
                          src={ad.creativeUrl}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : null}
                      <div className="absolute bottom-2 left-2 pointer-events-none">
                        <span className="rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                          Sponsored
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <span className="font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 text-sm sm:text-base">
                        {ad.title}
                      </span>
                      {ad.description?.trim() && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 sm:text-sm">
                          {ad.description}
                        </p>
                      )}
                      {!ad.productId && !ad.serviceId && (
                        <span className="mt-2 inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          Business ad
                        </span>
                      )}
                      <span className="mt-2 inline-flex text-sm font-medium text-blue-600 group-hover:underline">
                        View details →
                      </span>
                    </div>
                  </Link>
                );
              })}
              </div>
            </div>
          </section>
        )}

        {/* Explore products / For you: grid (filters hidden on home — use /browse to refine) */}
        {status === "authenticated" &&
          session?.user?.role === UserRole.CUSTOMER &&
          hasCategoryInterests &&
          randomProducts.length === 0 &&
          !interestModalOpen && (
            <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
              <h2 className="mb-2 text-lg font-bold text-slate-800 sm:text-xl">For you</h2>
              <p className="mb-4 max-w-lg text-sm text-slate-600">
                Nothing listed in your categories yet. Browse the marketplace to discover more.
              </p>
              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
                <Link href="/browse">Browse products</Link>
              </Button>
            </section>
          )}

        {randomProducts.length > 0 && (
          <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
            <h2 className="mb-4 text-lg font-bold text-slate-800 sm:mb-6 sm:text-xl">
              {status === "authenticated" && session?.user?.role === UserRole.CUSTOMER && hasCategoryInterests
                ? "For you"
                : "Explore products"}
            </h2>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {exploreProductsPreview.map((p, pIdx) => {
                const ProductIcon = PRODUCT_PLACEHOLDER_ICONS[pIdx % PRODUCT_PLACEHOLDER_ICONS.length];
                return (
                <Link key={p.id} href={`/product/${p.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col overflow-hidden border-0 bg-white shadow-md transition-shadow group-hover:shadow-lg">
                    <div className="relative aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                      <div className="absolute right-2 top-2 z-10">
                        <WishlistButton productId={p.id} />
                      </div>
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ProductIcon className="h-14 w-14 text-slate-400" />
                      )}
                    </div>
                    <CardContent className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.seller?.store?.name ?? "Store"}</p>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <p className="font-bold text-blue-600">{formatCurrency(Math.max(0, p.basePrice - p.discount))}</p>
                        {(p._count?.reviews ?? 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <StarRow rating={p.averageRating ?? 0} size="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium text-slate-700">{(p.averageRating ?? 0).toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-auto pt-3">
                        <AddToCartButton
                          productId={p.id}
                          name={p.name}
                          price={Math.max(0, p.basePrice - p.discount)}
                          image={Array.isArray(p.images) ? p.images[0] : null}
                          size="sm"
                          label="Add to Cart"
                          className="w-full justify-center px-2 text-xs sm:px-3 sm:text-sm"
                          ariaLabel={`Add ${p.name} to cart`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );})}
            </div>
          </section>
        )}

        {/* Explore services: responsive carousel directly after explore products */}
        {homeServices.length > 0 && (
          <section className="container mx-auto px-3 sm:px-4 pb-6 sm:pb-8">
            <div className="mb-4 sm:mb-5 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Explore services</h2>
              
            </div>
            <div className="relative">
              {homeServices.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:-left-3 sm:h-9 sm:w-9"
                    onClick={() => {
                      const el = serviceCarouselRef.current;
                      if (!el) return;
                      const card = el.querySelector("[data-service-card]") as HTMLElement | null;
                      const gap = 12;
                      const cardWidth = (card?.getBoundingClientRect().width ?? 220) + gap;
                      el.scrollLeft = Math.max(0, el.scrollLeft - cardWidth);
                    }}
                    aria-label="Previous services"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:-right-3 sm:h-9 sm:w-9"
                    onClick={() => {
                      const el = serviceCarouselRef.current;
                      if (!el) return;
                      const card = el.querySelector("[data-service-card]") as HTMLElement | null;
                      const gap = 12;
                      const cardWidth = (card?.getBoundingClientRect().width ?? 220) + gap;
                      el.scrollLeft = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + cardWidth);
                    }}
                    aria-label="Next services"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <div
                ref={serviceCarouselRef}
                className="flex gap-3 overflow-x-auto overflow-y-hidden py-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
              >
                {homeServices.map((s, idx) => {
                  const ServiceIcon = SERVICE_PLACEHOLDER_ICONS[idx % SERVICE_PLACEHOLDER_ICONS.length];
                  const imageUrl = serviceFirstImage(s.images);
                  const finalPrice = s.basePrice == null ? null : Math.max(0, s.basePrice - (s.discount ?? 0));
                  return (
                    <Link
                      key={s.id}
                      href={`/service/${s.id}`}
                      data-service-card
                      className="group flex w-[78vw] max-w-[280px] min-w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg sm:w-[280px]"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        <div className="absolute right-2 top-2 z-10">
                          <WishlistButton serviceId={s.id} />
                        </div>
                        {imageUrl ? (
                          <img src={imageUrl} alt={s.name} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                        ) : (
                          <ServiceIcon className="h-12 w-12 text-slate-400" />
                        )}
                      </div>
                      <CardContent className="p-3 sm:p-4">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{s.seller?.store?.name ?? "Service seller"}</p>
                        <p className="text-xs text-slate-500">{s.serviceCategory?.name ?? "Service"}</p>
                        <div className="flex items-center justify-between gap-1 mt-2">
                          <p className="text-sm font-bold text-blue-600">
                            {finalPrice == null ? "Contact for price" : formatCurrency(finalPrice)}
                          </p>
                          {(s._count?.reviews ?? 0) > 0 && (
                            <div className="flex items-center gap-1">
                              <StarRow rating={s.averageRating ?? 0} size="h-3 w-3" />
                              <span className="text-[10px] font-medium text-slate-600">{(s.averageRating ?? 0).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
                <Link href="/browse">View all</Link>
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
