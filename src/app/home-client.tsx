"use client";

import { useState, useEffect } from "react";
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
  const [productsByCategory, setProductsByCategory] = useState<Record<string, Product[]>>({});
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    fetch("/api/home/banners")
      .then((r) => r.json())
      .then(setBanners)
      .catch(() => setBanners([]));
  }, []);

  useEffect(() => {
    fetch("/api/home/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setCategories([]));
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

  const latestCategories = categories.slice(0, 4);

  return (
    <PublicLayout>
        {/* Dynamic banner carousel - full width, tall enough to show banner fully */}
        {banners.length > 0 && (
          <section className="relative w-full max-w-[100vw] bg-muted">
            <div className="relative w-full min-h-[280px] sm:min-h-[320px] md:min-h-[380px] overflow-hidden">
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
                      className="size-full object-cover object-center"
                    />
                    <div className="absolute bottom-4 left-4 right-4 drop-shadow-md">
                      <h2 className="text-2xl font-bold text-blue-100 md:text-3xl [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{banner.bannerHeading}</h2>
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
                  className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => setBannerIndex((i) => (i - 1 + banners.length) % banners.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => setBannerIndex((i) => (i + 1) % banners.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </section>
        )}

        {/* Category boxes */}
        {latestCategories.length > 0 && (
          <section className="container mx-auto px-4 py-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {latestCategories.map((cat) => (
                <Card key={cat.id} className="overflow-hidden border-0 bg-white shadow-md transition-shadow hover:shadow-lg">
                  <CardContent className="p-4">
                    <h3 className="mb-3 font-semibold text-slate-800">{cat.name}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.subcategories.slice(0, 4).map((sub, subIdx) => {
                        const SubIcon = SUB_PLACEHOLDER_ICONS[subIdx % SUB_PLACEHOLDER_ICONS.length];
                        return (
                        <Link
                          key={sub.id}
                          href={`/browse?subcategoryId=${sub.id}`}
                          className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2 transition-colors hover:bg-slate-100"
                        >
                          <div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                            {sub.image ? (
                              <img src={sub.image} alt={sub.name} className="h-full w-full object-cover" />
                            ) : (
                              <SubIcon className="h-8 w-8 text-slate-400" />
                            )}
                          </div>
                          <span className="mt-1 text-center text-xs font-medium text-slate-700 line-clamp-2">{sub.name}</span>
                        </Link>
                      );})}
                    </div>
                    <Link
                      href={`/browse?categoryId=${cat.id}`}
                      className="mt-3 block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      View all
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Best Sellers: Amazon-style horizontal carousels */}
        {latestCategories.filter((c) => (productsByCategory[c.id]?.length ?? 0) > 0).length > 0 && (
          <section className="border-t border-blue-100 bg-white/70 py-8">
            <div className="container mx-auto space-y-8 px-4">
              {latestCategories.slice(0, 2).map((cat) => {
                const products = productsByCategory[cat.id] ?? [];
                if (products.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h2 className="mb-4 text-xl font-bold text-slate-800">Best Sellers in {cat.name}</h2>
                    <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth [scrollbar-width:thin]">
                      {products.map((p, pIdx) => {
                        const ProductIcon = PRODUCT_PLACEHOLDER_ICONS[pIdx % PRODUCT_PLACEHOLDER_ICONS.length];
                        return (
                        <Link
                          key={p.id}
                          href={`/product/${p.id}`}
                          className="flex w-40 shrink-0 flex-col overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-lg"
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
                      );})}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sponsored ads - grid, all ads, video playable */}
        {ads.length > 0 && (
          <section className="container mx-auto px-4 py-8">
            <div className="mb-6 flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Sponsored</h2>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {ads.length} {ads.length === 1 ? "ad" : "ads"}
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ads.map((ad) => {
                const adHref = ad.productId ? `/product/${ad.productId}` : ad.serviceId ? `/service/${ad.serviceId}` : "/browse";
                const isVideo = ad.creativeType === "VIDEO";
                const youtubeEmbed = isVideo ? getYoutubeEmbedUrl(ad.creativeUrl) : null;
                return (
                  <div
                    key={ad.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      {isVideo ? (
                        youtubeEmbed ? (
                          <iframe
                            src={youtubeEmbed}
                            title={ad.title}
                            className="h-full w-full object-cover"
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
                      <div className="absolute bottom-2 left-2">
                        <span className="rounded bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
                          Sponsored
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <Link
                        href={adHref}
                        className="font-semibold text-slate-900 line-clamp-2 hover:text-blue-600 hover:underline"
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
          </section>
        )}

        {/* Explore products: Amazon-style grid */}
        {randomProducts.length > 0 && (
          <section className="container mx-auto px-4 py-8">
            <h2 className="mb-6 text-xl font-bold text-slate-800">Explore products</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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

        {/* Loader when no data yet */}
        {banners.length === 0 && categories.length === 0 && randomProducts.length === 0 && (
          <PageLoader message="Loading your store…" />
        )}
    </PublicLayout>
  );
}
