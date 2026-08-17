"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Store,
  ShieldCheck,
  Truck,
  Zap,
  Flame,
  Clock,
  History,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getYoutubeEmbedUrl, getYoutubeThumbnailUrl } from "@/lib/youtube";
import { PageLoader } from "@/components/ui/page-loader";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { WishlistButton } from "@/components/product/WishlistButton";

const SUB_PLACEHOLDER_ICONS = [Package, Folder, LayoutGrid, Tag, BookOpen, Briefcase, Dumbbell, Music];
const PRODUCT_PLACEHOLDER_ICONS = [ShoppingBag, Box, Package, Gift, Sparkles, Tag];
const SERVICE_PLACEHOLDER_ICONS = [Briefcase, Sparkles, Tag, Music, Dumbbell, Folder];

const PRODUCT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
];

const getProductImg = (img?: string | null, idx: number = 0) => {
  if (img && typeof img === "string" && img.trim().length > 0) return img;
  return PRODUCT_FALLBACK_IMAGES[idx % PRODUCT_FALLBACK_IMAGES.length];
};

const formatDynamicTimeAgo = (timestamp?: string | Date | number | null, indexFallback: number = 0): string => {
  if (timestamp) {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
    }
  }
  const relativeMinutes = (indexFallback + 1) * 7 + 3;
  if (relativeMinutes < 60) return `${relativeMinutes}m ago`;
  const relativeHours = Math.floor(relativeMinutes / 60) + 1;
  if (relativeHours < 24) return `${relativeHours}h ago`;
  return `${Math.floor(relativeHours / 24)}d ago`;
};

const getAmazonHeadline = (catName: string, idx: number): string => {
  const headlines = [
    `Deals on ${catName}`,
    `${catName} curated for you`,
    `Deals on ${catName}`,
    `Top brand deals for ${catName}`,
    `Big savings on ${catName}`,
    `Featured picks in ${catName}`,
  ];
  return headlines[idx % headlines.length];
};

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
  const [bannerCarouselPaused, setBannerCarouselPaused] = useState(false);
  const { data: session, status } = useSession();
  const [ads, setAds] = useState<Ad[]>([]);
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false);
  const [sponsoredIndex, setSponsoredIndex] = useState(0);
  const sponsoredScrollRef = useRef<HTMLDivElement>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [categoryCarouselPaused, setCategoryCarouselPaused] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const recentScrollRef = useRef<HTMLDivElement>(null);

  // Recommended for You section products (from randomProducts prop)
  const displayRecommendedProducts = useMemo<Product[]>(() => {
    return randomProducts || [];
  }, [randomProducts]);

  // Persistent Countdown Timer for Deals of the Day (stored in localStorage)
  const [timeLeft, setTimeLeft] = useState({ hours: 8, minutes: 42, seconds: 15 });

  useEffect(() => {
    const STORAGE_KEY = "marketplace_deals_countdown_end_v1";
    let targetEnd = 0;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > Date.now()) {
          targetEnd = parsed;
        }
      }
    } catch (_) { }

    if (!targetEnd) {
      targetEnd = Date.now() + 12 * 60 * 60 * 1000;
      try {
        localStorage.setItem(STORAGE_KEY, targetEnd.toString());
      } catch (_) { }
    }

    const updateTimer = () => {
      const diff = Math.max(0, targetEnd - Date.now());
      if (diff <= 0) {
        targetEnd = Date.now() + 12 * 60 * 60 * 1000;
        try {
          localStorage.setItem(STORAGE_KEY, targetEnd.toString());
        } catch (_) { }
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (categories.length <= 1 || categoryCarouselPaused) return;
    const t = setInterval(() => {
      setCategoryIndex((i) => (i + 1) % categories.length);
    }, 3500);
    return () => clearInterval(t);
  }, [categories.length, categoryCarouselPaused]);

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el || categories.length === 0) return;
    const card = el.querySelector("[data-category-card]") as HTMLElement | null;
    const gap = 16;
    const cardWidth = (card?.getBoundingClientRect().width ?? 200) + gap;
    el.scrollLeft = Math.min(categoryIndex * cardWidth, el.scrollWidth - el.clientWidth);
  }, [categoryIndex, categories.length]);

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
    fetch("/api/home/banners?targetType=product")
      .then((r) => r.json())
      .then((data: any) => {
        // API already filters by targetType=product (active, non-restaurant/hotel/service)
        // Limit to max 4 banners for home carousel
        if (Array.isArray(data)) {
          setBanners(data);
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
    fetch("/api/customer/recent-searches", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Product[]) => setRecentViewProducts(Array.isArray(data) ? data : []))
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
        .catch(() => { });
    });
  }, [categories, featuredCategories]);

  useEffect(() => {
    if (banners.length <= 1 || bannerCarouselPaused) return;
    const t = setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length);
    }, 8000);
    return () => clearInterval(t);
  }, [banners.length, bannerCarouselPaused]);

  useEffect(() => {
    fetch("/api/home/ads?type=product&limit=all")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const productOnlyAds = data.filter(
            (a: any) =>
              !a.serviceId &&
              !a.hotelId &&
              !a.foodItemId &&
              !a.title?.toLowerCase().includes("maintenance") &&
              !a.title?.toLowerCase().includes("repair") &&
              !a.title?.toLowerCase().includes("washing machine") &&
              !a.title?.toLowerCase().includes("fridge") &&
              !a.title?.toLowerCase().includes("cleaning")
          );
          const shuffled = [...productOnlyAds].sort(() => Math.random() - 0.5);
          setAds(shuffled);
          if (shuffled.length > 0) {
            setSponsoredIndex(Math.floor(Math.random() * shuffled.length));
          }
        } else {
          setAds([]);
        }
      })
      .catch(() => setAds([]));
  }, []);

  // Sponsored carousel: auto-advance right-to-left every 3s; loops from last ad back to first
  useEffect(() => {
    if (ads.length <= 1 || sponsoredCarouselPaused) return;
    const t = setInterval(() => {
      setSponsoredIndex((i) => (i + 1) % ads.length);
    }, 8000);
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
      .catch(() => { });
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
            {/* Hero Banner with sharp edges (no rounded corners), small side gap, and no top gap */}
            <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 pt-0">
              <section
                className="relative w-full bg-slate-900 overflow-hidden rounded-none aspect-[16/4.8] sm:aspect-[16/6.6] min-h-[130px] sm:min-h-[220px]"
                onMouseEnter={() => setBannerCarouselPaused(true)}
                onMouseLeave={() => setBannerCarouselPaused(false)}
              >
                {banners.length > 0 ? (
                  <>
                    <div className="relative w-full h-full overflow-hidden">
                      {banners.map((banner, i) => (
                        <div
                          key={banner.id}
                          className={`absolute inset-0 transition-opacity duration-500 ${i === bannerIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                            }`}
                        >
                          <Link
                            href={`/banner/${banner.id}`}
                            className="block size-full"
                          >
                            <img
                              src={isMobileViewport && (banner as any).mobileBanner ? (banner as any).mobileBanner : banner.bannerImage}
                              alt={banner.bannerHeading}
                              className="h-full w-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 via-transparent to-transparent pointer-events-none" />
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
                          className="absolute left-2 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full shadow-md bg-white/80 text-slate-900 hover:bg-white sm:left-4 sm:h-11 sm:w-11"
                          onClick={() => setBannerIndex((i) => (i - 1 + banners.length) % banners.length)}
                        >
                          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-2 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full shadow-md bg-white/80 text-slate-900 hover:bg-white sm:right-4 sm:h-11 sm:w-11"
                          onClick={() => setBannerIndex((i) => (i + 1) % banners.length)}
                        >
                          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 sm:bottom-4">
                          {banners.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setBannerIndex(idx)}
                              className={`h-1.5 rounded-full transition-all duration-300 sm:h-2 ${bannerIndex === idx ? "w-5 bg-white sm:w-6" : "w-1.5 bg-white/50 sm:w-2"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : null}
              </section>
            </div>

            {/* Category cards — overlapping lower 30% empty background wave area of hero banner with 2-side outer gaps */}
            <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 mt-4 sm:-mt-28 md:-mt-32 lg:-mt-36 xl:-mt-40 relative z-20 pb-6 sm:pb-8 flex items-center justify-center">
              {latestCategories.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 w-full">
                  {latestCategories.map((cat, catIdx) => (
                    <Card key={cat.id} className="overflow-hidden border border-slate-200/60 bg-white p-4 sm:p-5 shadow-lg transition-shadow hover:shadow-xl rounded-none flex flex-col justify-between">
                      <CardContent className="p-0 flex flex-col h-full justify-between">
                        <div>
                          <h3 className="mb-3 font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight leading-snug line-clamp-2 h-14 flex items-center">
                            {getAmazonHeadline(cat.name, catIdx)}
                          </h3>
                          <div className="grid grid-cols-2 gap-2.5 flex-1">
                            {cat.subcategories.slice(0, 4).map((sub, subIdx) => {
                              const SubIcon = SUB_PLACEHOLDER_ICONS[subIdx % SUB_PLACEHOLDER_ICONS.length];
                              return (
                                <Link
                                  key={sub.id}
                                  href={`/browse?subcategoryId=${sub.id}`}
                                  className="group flex flex-col bg-white p-0 transition-all hover:opacity-95"
                                >
                                  <div className="relative aspect-square w-full overflow-hidden rounded-none bg-white flex items-center justify-center p-0 border-0 shadow-none">
                                    {(() => {
                                      const src = isMobileViewport && sub.mobileIcon ? sub.mobileIcon : sub.image;
                                      return src ? (
                                        <img src={src} alt={sub.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                      ) : (
                                        <SubIcon className="h-10 w-10 text-slate-400" />
                                      );
                                    })()}
                                  </div>
                                  <span className="mt-1.5 text-xs font-medium text-slate-800 line-clamp-2 leading-tight group-hover:text-blue-600 group-hover:underline">{sub.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                        <Link
                          href={`/browse?categoryId=${cat.id}`}
                          className="mt-4 block text-xs font-bold text-blue-600 hover:text-amber-700 hover:underline"
                        >
                          See all offers
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </section>

            {/* 1. Recently Viewed Products (Showing ALL recently viewed products with clean UI) */}
            {(() => {
              const recentList = recentViewProducts.length > 0 ? recentViewProducts : randomProducts;
              if (recentList.length === 0) return null;

              return (
                <section className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white py-6 sm:py-8">
                  <div className="container mx-auto px-3 sm:px-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 sm:text-xl flex items-center gap-2">
                          <History className="h-5 w-5 text-blue-600" />
                          Recently Viewed Products
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {recentList.length > 2 && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50 cursor-pointer"
                              onClick={() => {
                                const el = recentScrollRef.current;
                                if (el) el.scrollBy({ left: -320, behavior: "smooth" });
                              }}
                              aria-label="Previous recently viewed"
                            >
                              <ChevronLeft className="h-4 w-4 text-slate-700" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50 cursor-pointer"
                              onClick={() => {
                                const el = recentScrollRef.current;
                                if (el) el.scrollBy({ left: 320, behavior: "smooth" });
                              }}
                              aria-label="Next recently viewed"
                            >
                              <ChevronRight className="h-4 w-4 text-slate-700" />
                            </Button>
                          </div>
                        )}
                        <Link href="/browse" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline ml-1">
                          Browse all
                        </Link>
                      </div>
                    </div>

                    <div
                      ref={recentScrollRef}
                      className="flex gap-3.5 overflow-x-auto py-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {recentList.map((p, idx) => {
                        const finalPrice = Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0));
                        const imgSrc = getProductImg(p.images?.[0], idx);
                        const timeLabel = formatDynamicTimeAgo((p as any).viewedAt || (p as any).createdAt, idx);
                        return (
                          <div
                            key={`recent_${p.id}_${idx}`}
                            className="group flex w-[42vw] min-w-[185px] max-w-[210px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 sm:min-w-[195px]"
                          >
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
                              <span className="absolute left-2 top-2 z-10 rounded-full bg-slate-900/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5 text-blue-300" />
                                {timeLabel}
                              </span>
                              <div className="absolute right-2 top-2 z-10">
                                <WishlistButton productId={p.id} name={p.name} image={imgSrc} price={p.basePrice} />
                              </div>
                              <Link href={`/product/${p.id}`} className="block h-full w-full">
                                <img
                                  src={imgSrc}
                                  alt={p.name}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  loading="lazy"
                                />
                              </Link>
                            </div>
                            <div className="mt-2.5 flex flex-col">
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate mb-0.5">
                                {p.seller?.store?.name ?? "Verified Store"}
                              </p>
                              <Link href={`/product/${p.id}`} className="block">
                                <p className="line-clamp-2 h-[34px] text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug flex items-start">
                                  {p.name}
                                </p>
                              </Link>
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 h-6 min-w-0 overflow-hidden">
                                <span className="text-xs sm:text-sm font-black text-blue-600 truncate whitespace-nowrap">
                                  {formatCurrency(finalPrice)}
                                </span>
                                <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 shrink-0">
                                  <StarRow rating={p.averageRating ?? 4.9} size="h-3 w-3" />
                                  <span>{(p.averageRating ?? 4.9).toFixed(1)}</span>
                                </div>
                              </div>
                              <AddToCartButton
                                productId={p.id}
                                name={p.name}
                                price={finalPrice}
                                image={imgSrc}
                                size="sm"
                                label="Add to Cart"
                                className="w-full h-8 text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-xl transition-all shadow-sm active:scale-95 mt-2"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 2. Sponsored Product Spotlight (Random Product Ad on Each Page Reload) */}
            {(() => {
              const activeAd = ads.length > 0 ? (ads[sponsoredIndex] || ads[0]) : null;
              if (!activeAd) return null;
              const dynamicPrice = (activeAd as any).targetPrice || (activeAd as any).price || (activeAd as any).product?.basePrice;
              const dynamicRating = (activeAd as any).product?.averageRating ?? 4.9;

              return (
                <section className="container mx-auto px-3 sm:px-4 py-4">
                  <div className="relative overflow-hidden rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-blue-600/10 p-5 sm:p-8 shadow-xl">
                    {/* Glowing background ambient lights */}
                    <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
                    <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center relative z-10">
                      {/* Left: Video / Banner Creative */}
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900/10 shadow-lg md:col-span-6 lg:col-span-5">
                        <img
                          src={getYoutubeThumbnailUrl(activeAd.creativeUrl) || activeAd.creativeUrl || getProductImg(null, 0)}
                          alt={activeAd.title}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                        />
                        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                          <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                            ★ Sponsored Spotlight
                          </span>
                        </div>
                      </div>

                      {/* Right: Filled Detailed Information & Feature Badges */}
                      <div className="flex flex-col justify-between md:col-span-6 lg:col-span-7 space-y-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-xs font-bold text-amber-800">
                              <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Featured Merchant Offer
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                              Verified Ad
                            </span>
                          </div>

                          <h3 className="text-xl sm:text-3xl font-black text-slate-900 leading-snug tracking-tight">
                            {activeAd.title}
                          </h3>

                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium line-clamp-2">
                            {activeAd.description || "Discover premium quality, top customer satisfaction, and exclusive time-limited promotional pricing direct from verified marketplace sellers."}
                          </p>
                        </div>

                        {/* Feature Badges Grid - Fills out the section with rich details */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1">
                          <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-amber-200/60 p-2 shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                              <Truck className="h-4 w-4 text-amber-700" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-extrabold text-slate-900 truncate">Express Delivery</span>
                              <span className="text-[9px] text-slate-500 truncate">Available Today</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-blue-200/60 p-2 shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <ShieldCheck className="h-4 w-4 text-blue-700" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-extrabold text-slate-900 truncate">Verified Seller</span>
                              <span className="text-[9px] text-slate-500 truncate">100% Authentic</span>
                            </div>
                          </div>

                          <div className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-xl bg-white/80 border border-emerald-200/60 p-2 shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                              <Zap className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-extrabold text-slate-900 truncate">Limited Offer</span>
                              <span className="text-[9px] text-slate-500 truncate">Best Guarantee</span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Action Row */}
                        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {dynamicPrice ? (
                              <span className="text-2xl sm:text-3xl font-black text-blue-600">
                                {formatCurrency(dynamicPrice)}
                              </span>
                            ) : null}
                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700">
                              <StarRow rating={dynamicRating} size="h-3.5 w-3.5" />
                              <span>{dynamicRating.toFixed(1)}</span>
                            </div>
                          </div>

                          <Button asChild className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-extrabold text-xs sm:text-sm px-7 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                            <Link href={`/api/ads/click?adId=${activeAd.id}&redirect_to_ad=true`}>
                              Shop Product Now
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 3. Shop Products – Up to 50% Off */}
            <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 border-t border-slate-100">
              <div className="mb-4 sm:mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Shop Products – Up to 50% Off
                </h2>
                <Link href="/browse?discount=50" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                  See all
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {randomProducts.slice(0, 6).map((p, idx) => {
                  const finalPrice = Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0));
                  const originalPrice = p.basePrice > finalPrice ? p.basePrice : finalPrice * 1.5;
                  const imgSrc = getProductImg(p.images?.[0], idx);
                  return (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow">
                          -50% OFF
                        </span>
                        <div className="absolute right-1.5 top-1.5 z-10">
                          <WishlistButton productId={p.id} name={p.name} image={imgSrc} price={p.basePrice} />
                        </div>
                        <img
                          src={imgSrc}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-2 flex flex-col">
                        <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider truncate mb-0.5">
                          {p.seller?.store?.name ?? "Certified Store"}
                        </p>
                        <p className="line-clamp-2 h-[32px] text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                          {p.name}
                        </p>
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 h-5 min-w-0 overflow-hidden">
                          <span className="text-xs font-black text-blue-600 truncate whitespace-nowrap">
                            {formatCurrency(finalPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through truncate whitespace-nowrap">
                            {formatCurrency(originalPrice)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <AddToCartButton
                            productId={p.id}
                            name={p.name}
                            price={finalPrice}
                            image={imgSrc}
                            size="sm"
                            label="Add to Cart"
                            className="w-full h-7 text-[11px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-lg transition-all shadow-sm active:scale-95"
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* 4. Shop by Product Category (Auto-Moving Carousel with Working Control Buttons) */}
            <section
              className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 border-t border-slate-100"
              onMouseEnter={() => setCategoryCarouselPaused(true)}
              onMouseLeave={() => setCategoryCarouselPaused(false)}
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2 text-sm sm:text-base font-black tracking-wider uppercase text-white shadow-lg shadow-blue-500/25">
                    <LayoutGrid className="h-4 sm:h-5 w-4 sm:w-5" /> Shop by Category
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-blue-700 border border-blue-200/80">
                    <Sparkles className="h-4 w-4 text-blue-500" /> Explore Collections
                  </span>
                </div>
                <Link href="/browse" className="text-xs sm:text-sm font-extrabold text-blue-600 hover:text-blue-800 hover:underline">
                  View All Categories
                </Link>
              </div>
              <div className="relative">
                {categories.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute left-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:left-2 bg-white/90 text-slate-700 hover:bg-white cursor-pointer"
                      onClick={() => {
                        setCategoryCarouselPaused(true);
                        const el = categoryScrollRef.current;
                        if (el) {
                          const card = el.querySelector("[data-category-card]") as HTMLElement | null;
                          const cardWidth = (card?.getBoundingClientRect().width ?? 140) + 16;
                          el.scrollBy({ left: -cardWidth * 2, behavior: "smooth" });
                        }
                      }}
                      aria-label="Previous category"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-0 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md sm:right-2 bg-white/90 text-slate-700 hover:bg-white cursor-pointer"
                      onClick={() => {
                        setCategoryCarouselPaused(true);
                        const el = categoryScrollRef.current;
                        if (el) {
                          const card = el.querySelector("[data-category-card]") as HTMLElement | null;
                          const cardWidth = (card?.getBoundingClientRect().width ?? 140) + 16;
                          el.scrollBy({ left: cardWidth * 2, behavior: "smooth" });
                        }
                      }}
                      aria-label="Next category"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <div
                  ref={categoryScrollRef}
                  className="flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden scroll-smooth py-3 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  style={{ scrollBehavior: categoryCarouselPaused ? "auto" : "smooth" }}
                >
                  {categories.map((cat, idx) => {
                    const categoryImg = cat.subcategories?.[0]?.image || getProductImg(null, idx + 1);

                    return (
                      <Link
                        key={cat.id}
                        href={`/browse?categoryId=${cat.id}`}
                        data-category-card
                        onClick={() => setCategoryCarouselPaused(true)}
                        className="group flex flex-col items-center shrink-0 snap-start transition-all duration-300 hover:-translate-y-1 w-[150px] sm:w-[185px]"
                      >
                        {/* Half-moon / arch dome cropped image without background color */}
                        <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-t-full rounded-b-none overflow-hidden flex items-center justify-center shrink-0 shadow-sm border-b-2 border-slate-200 group-hover:border-blue-500 transition-colors">
                          <img
                            src={categoryImg}
                            alt={cat.name}
                            className="h-full w-full object-cover group-hover:scale-108 transition-transform duration-300"
                          />
                        </div>
                        <span className="mt-2.5 text-center text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors max-w-[140px] sm:max-w-[175px]">
                          {cat.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>



            {/* 6. Dynamic Mega Sale Banner & Featured Mega Sale Products */}
            <section className="container mx-auto px-3 sm:px-4 py-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 p-8 sm:p-14 text-white shadow-2xl border border-blue-800/40">
                {/* Glowing background light ambient orbs */}
                <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-rose-600/20 blur-3xl pointer-events-none" />
                <div className="absolute right-10 top-10 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl pointer-events-none" />
                <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 px-3.5 py-1 text-xs font-black tracking-wider uppercase text-white shadow-md shadow-red-500/20">
                        <Flame className="h-4 w-4 animate-bounce" /> MEGA SALE EVENT
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30">
                        <Sparkles className="h-3.5 w-3.5" /> Limited Time Offers
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
                      Big Savings & Special Offers | Up to {randomProducts.length > 0 ? Math.max(50, ...randomProducts.map(p => Math.round(((p.discount || (p.basePrice * 0.5)) / (p.basePrice || (p.discount || 1) * 2)) * 100))) : 50}% Off Everything
                    </h2>

                    <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                      Unlock unbeatable dynamic prices across top product lines. Limited time deals with free express shipping & hassle-free returns.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <Button asChild className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35 transition-all duration-300 hover:-translate-y-1">
                        <Link href="/browse?discount=50">Shop Dynamic Deals Now</Link>
                      </Button>
                      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        ✓ Verified Quality Guaranteed
                      </span>
                    </div>
                  </div>

                  {/* Decorative glassmorphism highlight card on right side */}
                  <div className="hidden lg:flex flex-col items-center justify-center p-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl text-center shrink-0 w-64">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-red-500 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg mb-3">
                      %
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
                      Flash Price Drop
                    </span>
                    <span className="mt-1 text-2xl font-black text-white">
                      Instant Savings
                    </span>
                    <span className="mt-2 text-[11px] text-slate-300 font-medium">
                      Applied automatically at checkout
                    </span>
                  </div>
                </div>
              </div>

              {/* Embedded Dynamic Mega Sale Product Showcase Grid (Spacious 4-column card grid with large square images) */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {randomProducts.slice(0, 4).map((p, idx) => {
                  const finalPrice = Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0));
                  const savings = p.discount > 0 ? p.discount : Math.round((p.basePrice || finalPrice * 2) * 0.5);
                  const originalPrice = (p.basePrice > finalPrice ? p.basePrice : finalPrice + savings);
                  const discountPct = Math.min(75, Math.max(25, Math.round((savings / originalPrice) * 100)));
                  const imgSrc = getProductImg(p.images?.[0], idx + 3);
                  return (
                    <Link
                      key={`mega_${p.id}`}
                      href={`/product/${p.id}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all duration-300 hover:border-amber-300 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
                        <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md">
                          -{discountPct}% OFF
                        </span>
                        <img
                          src={imgSrc}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-3 flex flex-col flex-1 justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate mb-1">
                            {p.seller?.store?.name ?? "Certified Store"}
                          </p>
                          <p className="line-clamp-2 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                            {p.name}
                          </p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                          <div>
                            <span className="text-sm sm:text-base font-black text-red-600 mr-1.5">{formatCurrency(finalPrice)}</span>
                            <span className="text-xs text-slate-400 line-through">{formatCurrency(originalPrice)}</span>
                          </div>
                          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                            Save {formatCurrency(savings)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Featured Brands & Top Stores */}
            <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
              <div className="rounded-3xl bg-gradient-to-b from-amber-50/50 via-orange-50/20 to-white p-6 sm:p-8 border border-amber-200/60 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200/90 px-5 py-2 text-sm sm:text-base font-black tracking-wide uppercase text-indigo-800 shadow-sm">
                      <Store className="h-4 sm:h-5 w-4 sm:w-5 text-indigo-600" /> Featured Stores & Top Brands
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-slate-700 border border-slate-200">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified Sellers
                    </span>
                  </div>
                  <Link href="/browse" className="text-xs sm:text-sm font-extrabold text-indigo-700 hover:text-indigo-900 hover:underline">
                    Explore All Stores
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(() => {
                    const extractedStores = Array.from(
                      new Map(
                        randomProducts
                          .filter((p) => Boolean(p.seller?.store?.name))
                          .map((p, idx) => {
                            const storeName = p.seller?.store?.name || "Official Store";
                            const sellerId = (p as any).seller?.id || (p as any).sellerId;
                            return [
                              storeName,
                              {
                                id: sellerId || p.id,
                                name: storeName,
                                sellerId: sellerId,
                                image: getProductImg(p.images?.[0], idx),
                                category: p.category?.name || "Official Merchant",
                                rating: p.averageRating ? p.averageRating.toFixed(1) : "New Store",
                                productCount: randomProducts.filter(item => item.seller?.store?.name === storeName).length || (idx + 4),
                                badge: idx % 2 === 0 ? "Verified Merchant" : "Top Rated Store",
                              },
                            ];
                          })
                      ).values()
                    );

                    const fallbackStores = [
                      { id: "store_1", sellerId: undefined, name: "Apex Global Tech", category: "Electronics & Gadgets", rating: "4.9", productCount: 12, badge: "Official Store", image: getProductImg(null, 0) },
                      { id: "store_2", sellerId: undefined, name: "Urban Threads Co.", category: "Fashion & Apparel", rating: "4.8", productCount: 24, badge: "Verified Seller", image: getProductImg(null, 2) },
                      { id: "store_3", sellerId: undefined, name: "Nordic Living Lab", category: "Home & Lifestyle", rating: "4.9", productCount: 18, badge: "Top Rated", image: getProductImg(null, 4) },
                      { id: "store_4", sellerId: undefined, name: "Velocity Sports", category: "Fitness & Outdoor", rating: "4.8", productCount: 15, badge: "Certified", image: getProductImg(null, 5) },
                    ];

                    const displayStores = (extractedStores.length >= 4 ? extractedStores : [...extractedStores, ...fallbackStores]).slice(0, 4);

                    return displayStores.map((store, i) => {
                      const storeHref = store.sellerId
                        ? `/browse?sellerId=${store.sellerId}`
                        : `/browse?search=${encodeURIComponent(store.name)}`;

                      return (
                        <Link
                          key={store.id || `store_${i}`}
                          href={storeHref}
                          className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1"
                        >
                          <div>
                            {/* Store banner / Showcase image */}
                            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-100">
                              <img
                                src={store.image}
                                alt={store.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              <span className="absolute top-2 left-2 rounded-full bg-slate-900/85 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white shadow flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                                {store.badge || "Verified Store"}
                              </span>
                            </div>

                            {/* Store Info */}
                            <div className="mt-3.5 flex items-start gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                                {store.name.charAt(0)}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <h3 className="font-extrabold text-slate-900 text-base group-hover:text-amber-700 transition-colors truncate">
                                  {store.name}
                                </h3>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  {store.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Store Footer: Rating + Button */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                              <StarRow rating={parseFloat(store.rating)} size="h-3.5 w-3.5" />
                              <span>{store.rating}</span>
                            </div>

                            <span className="text-xs font-black text-amber-800 bg-amber-100/80 border border-amber-300/80 px-3 py-1 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-sm">
                              Visit Store
                            </span>
                          </div>
                        </Link>
                      );
                    });
                  })()}
                </div>
              </div>
            </section>

            {/* 7. Deals of the Day (With Persistent Countdown Timer & Add to Cart Button) */}
            <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 border-t border-slate-100">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200/90 px-5 py-2 text-sm sm:text-base font-black tracking-wide uppercase text-rose-700 shadow-sm">
                    <Zap className="h-4 sm:h-5 w-4 sm:w-5 fill-rose-500 text-rose-500" /> Deals of the Day
                  </span>
                  <div className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs sm:text-sm font-bold text-amber-400 border border-slate-800 shadow-sm">
                    <Clock className="h-4 w-4 animate-pulse text-amber-400" />
                    <span>
                      {String(timeLeft.hours).padStart(2, "0")}h : {String(timeLeft.minutes).padStart(2, "0")}m : {String(timeLeft.seconds).padStart(2, "0")}s
                    </span>
                  </div>
                </div>
                <Link href="/browse?deals=true" className="text-xs sm:text-sm font-extrabold text-rose-600 hover:text-rose-800 hover:underline">
                  See all deals
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-4">
                {randomProducts.slice(0, 8).map((p, idx) => {
                  const finalPrice = Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0));
                  const savings = p.discount > 0 ? p.discount : Math.round((p.basePrice || finalPrice * 1.5) * 0.35);
                  const originalPrice = (p.basePrice > finalPrice ? p.basePrice : finalPrice + savings);
                  const discountPct = Math.min(65, Math.max(20, Math.round((savings / originalPrice) * 100)));
                  const imgSrc = getProductImg(p.images?.[0], idx + 2);
                  return (
                    <div
                      key={p.id}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all duration-300 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
                          <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md">
                            -{discountPct}% OFF
                          </span>
                          <div className="absolute right-2 top-2 z-10">
                            <WishlistButton productId={p.id} name={p.name} image={imgSrc} price={p.basePrice} />
                          </div>
                          <Link href={`/product/${p.id}`} className="block h-full w-full">
                            <img
                              src={imgSrc}
                              alt={p.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          </Link>
                        </div>

                        <div className="mt-3 flex flex-col">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate mb-0.5">
                            {p.seller?.store?.name ?? "Certified Merchant"}
                          </p>
                          <Link href={`/product/${p.id}`} className="block">
                            <p className="line-clamp-2 h-[34px] text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                              {p.name}
                            </p>
                          </Link>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-1 h-5 min-w-0 overflow-hidden">
                          <span className="text-xs sm:text-sm font-black text-red-600 truncate whitespace-nowrap">
                            {formatCurrency(finalPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through truncate whitespace-nowrap">
                            {formatCurrency(originalPrice)}
                          </span>
                        </div>
                        <AddToCartButton
                          productId={p.id}
                          name={p.name}
                          price={finalPrice}
                          image={imgSrc}
                          size="sm"
                          label="Add to Cart"
                          className="w-full h-8 text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-xl transition-all shadow-sm active:scale-95 mt-2.5"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 8. Sponsored Showcase ("Show All Ads") */}
            {ads.length > 0 && (
              <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
                <div
                  className="rounded-3xl bg-gradient-to-br from-purple-100 via-indigo-50 to-purple-100/70 p-6 sm:p-8 border-2 border-purple-200/90 shadow-md"
                  onMouseEnter={() => setSponsoredCarouselPaused(true)}
                  onMouseLeave={() => setSponsoredCarouselPaused(false)}
                >
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-4 py-1.5 text-xs sm:text-sm font-black tracking-wider uppercase text-white shadow-md shadow-purple-500/20">
                        <Sparkles className="h-4 w-4 fill-amber-300 text-amber-300" /> Sponsored Showcase
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100/80 px-3.5 py-1 text-xs font-extrabold text-purple-800 border border-purple-300/80">
                        <Flame className="h-3.5 w-3.5 text-purple-600" /> Featured Advertisements
                      </span>
                    </div>
                    <Link href="/browse?tab=ads" className="text-xs sm:text-sm font-extrabold text-purple-700 hover:text-purple-900 hover:underline">
                      Show All Ads
                    </Link>
                  </div>

                  <div className="relative">
                    {ads.length > 1 && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute left-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full shadow-lg sm:left-2 bg-white/95 text-slate-800 hover:bg-white hover:scale-105 transition-all cursor-pointer border border-slate-200"
                          onClick={() => {
                            setSponsoredCarouselPaused(true);
                            setSponsoredIndex((i) => (i <= 0 ? ads.length - 1 : i - 1));
                          }}
                          aria-label="Previous ad"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full shadow-lg sm:right-2 bg-white/95 text-slate-800 hover:bg-white hover:scale-105 transition-all cursor-pointer border border-slate-200"
                          onClick={() => {
                            setSponsoredCarouselPaused(true);
                            setSponsoredIndex((i) => (i >= ads.length - 1 ? 0 : i + 1));
                          }}
                          aria-label="Next ad"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </>
                    )}

                    <div
                      ref={sponsoredScrollRef}
                      className="flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden scroll-smooth py-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      style={{ scrollBehavior: sponsoredCarouselPaused ? "auto" : "smooth" }}
                    >
                      {ads.map((ad, idx) => {
                        const adPageHref = `/api/ads/click?adId=${ad.id}&redirect_to_ad=true`;
                        const isVideo = ad.creativeType === "VIDEO";
                        const youtubeEmbed = isVideo ? getYoutubeEmbedUrl(ad.creativeUrl) : null;
                        const displayImage = getYoutubeThumbnailUrl(ad.creativeUrl) || ad.creativeUrl || getProductImg(null, idx);
                        return (
                          <Link
                            key={ad.id}
                            href={adPageHref}
                            data-sponsored-card
                            onClick={() => setSponsoredCarouselPaused(true)}
                            className="group flex w-[85vw] min-w-[270px] max-w-[330px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-purple-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-purple-400 hover:shadow-xl hover:-translate-y-1.5 sm:min-w-[290px] md:min-w-[310px]"
                          >
                            <div>
                              {/* Showcase Media Container */}
                              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-950 shadow-inner">
                                {displayImage ? (
                                  <img src={displayImage} alt={ad.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : isVideo && youtubeEmbed ? (
                                  <iframe src={youtubeEmbed} title={ad.title} className="h-full w-full object-cover pointer-events-none" />
                                ) : isVideo ? (
                                  <video src={ad.creativeUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                ) : null}

                                {/* Floating Ad Badge */}
                                <div className="absolute top-2.5 left-2.5 pointer-events-none flex gap-1">
                                  <span className="rounded-full bg-slate-950/85 backdrop-blur-md px-3 py-0.5 text-[10px] font-black text-amber-400 border border-amber-400/30 shadow flex items-center gap-1">
                                    ★ Featured Ad
                                  </span>
                                </div>
                              </div>

                              {/* Text Content */}
                              <div className="mt-3.5 flex flex-col">
                                <span className="font-black text-slate-900 line-clamp-2 group-hover:text-purple-700 transition-colors text-sm sm:text-base leading-snug">
                                  {ad.title}
                                </span>
                                {ad.description?.trim() && (
                                  <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-600 leading-relaxed">
                                    {ad.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Footer Action Row */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-700 border border-purple-200">
                                <Zap className="h-3 w-3 text-purple-600" /> Promoted Item
                              </span>
                              <span className="text-xs font-black text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl shadow-sm group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                Explore Deal
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 9. Recommended for You (Small images, 12 initial pagination, infinite auto scroll) */}
            <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 border-t border-slate-100">
              <div className="mb-4 sm:mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Recommended for You
                </h2>
                <Link href="/browse" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                  Browse all
                </Link>
              </div>

              {/* Compact 6-column grid with small image thumbnails */}
              {(() => {
                const displayList = displayRecommendedProducts;

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {displayList.map((p: Product, idx: number) => {
                        const finalPrice = Math.max(0, (p.basePrice ?? 0) - (p.discount ?? 0));
                        const imgSrc = getProductImg(p.images?.[0], idx);
                        return (
                          <div
                            key={`rec_real_${p.id}_${idx}`}
                            className="group flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
                          >
                            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">

                              <div className="absolute right-1.5 top-1.5 z-10">
                                <WishlistButton productId={p.id} name={p.name} image={imgSrc} price={p.basePrice} />
                              </div>
                              <Link href={`/product/${p.id}`} className="block h-full w-full">
                                <img
                                  src={imgSrc}
                                  alt={p.name}
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  loading="lazy"
                                />
                              </Link>
                            </div>

                            <div className="mt-2 flex flex-col flex-1 justify-between">
                              <div>
                                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider truncate mb-0.5">
                                  {p.seller?.store?.name ?? "Certified Store"}
                                </p>
                                <Link href={`/product/${p.id}`} className="block">
                                  <p className="line-clamp-2 h-[32px] text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                                    {p.name}
                                  </p>
                                </Link>
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 h-5 min-w-0 overflow-hidden">
                                  <span className="text-xs font-black text-blue-600 truncate whitespace-nowrap">
                                    {formatCurrency(finalPrice)}
                                  </span>
                                  <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 shrink-0">
                                    <StarRow rating={p.averageRating ?? 4.9} size="h-3 w-3" />
                                    <span>{(p.averageRating ?? 4.9).toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2">
                                <AddToCartButton
                                  productId={p.id}
                                  name={p.name}
                                  price={finalPrice}
                                  image={imgSrc}
                                  size="sm"
                                  label="Add to Cart"
                                  className="w-full h-7 text-[11px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-lg transition-all shadow-sm active:scale-95"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Clean See More Products Button */}
                    <div className="mt-8 flex justify-center">
                      <Link href="/browse">
                        <Button
                          variant="outline"
                          className="rounded-full px-8 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 bg-white hover:bg-slate-950 hover:text-white border-2 border-slate-300 hover:border-slate-950 shadow-md transition-all duration-300 hover:scale-105 flex items-center gap-2"
                        >
                          <span>See More Products</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </>
                );
              })()}
            </section>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
