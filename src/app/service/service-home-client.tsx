"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getYoutubeThumbnailUrl } from "@/lib/youtube"
import {
  Search,
  Wrench,
  Sparkles,
  ShieldCheck,
  Clock,
  Star,
  SlidersHorizontal,
  Store,
  CheckCircle2,
  X,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Card, CardContent } from "@/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { cn, formatCurrency } from "@/lib/utils"

export interface ServiceCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  mobileIcon?: string | null
  serviceCount?: number
}

export interface ServiceItem {
  id: string
  name: string
  slug: string
  description?: string | null
  serviceType: string
  basePrice?: number | null
  discount?: number
  hasGst?: boolean
  images?: any
  duration?: number | null
  isFeatured?: boolean
  rating?: number
  reviewCount?: number
  bookingsCount?: number
  serviceCategory?: {
    id: string
    name: string
    slug: string
    image?: string | null
  }
  seller?: {
    id: string
    userId: string
    store?: {
      name?: string
      logo?: string | null
      city?: string | null
    }
  }
}

export interface BannerItem {
  id: string
  bannerHeading: string
  bannerDescription?: string | null
  bannerImage: string
}

const CATEGORY_ICONS: Record<string, string> = {
  plumbing: "🔧",
  cleaning: "🧹",
  electrical: "⚡",
  appliance: "🔌",
  beauty: "💇‍♀️",
  salon: "💄",
  fitness: "🏋️‍♂️",
  painting: "🎨",
  carpentry: "🪚",
  gardening: "🪴",
  pest: "🪰",
  moving: "🚛",
  repair: "🔨",
  tech: "💻",
  automotive: "🚗",
}

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase()
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (n.includes(key)) return icon
  }
  return "🛠️"
}

function ServiceHomeContent() {
  const searchParams = useSearchParams()

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [spotlightServices, setSpotlightServices] = useState<ServiceItem[]>([])
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [ads, setAds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [bannerCarouselPaused, setBannerCarouselPaused] = useState(false)
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false)
  const [sponsoredIndex, setSponsoredIndex] = useState(0)
  const sponsoredScrollRef = useRef<HTMLDivElement>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  // Filters State
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || searchParams?.get("search") || "")
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams?.get("category") || searchParams?.get("serviceCategoryId") || "")
  const [minPrice, setMinPrice] = useState(searchParams?.get("minPrice") || "")
  const [maxPrice, setMaxPrice] = useState(searchParams?.get("maxPrice") || "")
  const [minRating, setMinRating] = useState(searchParams?.get("rating") || "")
  const [sortBy, setSortBy] = useState(searchParams?.get("sortBy") || "newest")

  const [totalAllServices, setTotalAllServices] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Fetch Service Categories, Banners & All Spotlight Services on mount
  useEffect(() => {
    fetch("/api/service-categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => {
        if (Array.isArray(data.categories)) {
          setCategories(data.categories)
        }
      })
      .catch((err) => console.error("Error loading service categories:", err))

    fetch("/api/home/banners?targetType=service")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data)
        }
      })
      .catch((err) => console.error("Error loading service banners:", err))

    // Fetch master services list for Category Spotlight Cards & Special Deals
    fetch("/api/services?limit=200")
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => {
        if (Array.isArray(data.services)) {
          setSpotlightServices(data.services)
        }
      })
      .catch((err) => console.error("Error loading spotlight services:", err))
  }, [])

  // Fetch Services & Banners (50 items per page with Load More)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (currentPage > 1) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set("search", searchQuery.trim())
    if (selectedCategoryId) params.set("serviceCategoryId", selectedCategoryId)
    if (minPrice) params.set("minPrice", minPrice)
    if (maxPrice) params.set("maxPrice", maxPrice)
    if (minRating) params.set("minRating", minRating)
    if (sortBy) params.set("sortBy", sortBy)
    params.set("limit", "50")
    params.set("page", String(currentPage))

    fetch(`/api/services?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { services: [], banners: [], pagination: {} }))
      .then((data) => {
        const fetchedServices = data.services || []
        if (currentPage > 1) {
          setServices((prev) => {
            const existingIds = new Set(prev.map((item) => item.id))
            const uniqueNew = fetchedServices.filter((item: any) => !existingIds.has(item.id))
            return [...prev, ...uniqueNew]
          })
        } else {
          setServices(fetchedServices)
        }

        if (data.pagination) {
          if (typeof data.pagination.total === "number") {
            setTotalAllServices(data.pagination.total)
          }
          if (typeof data.pagination.totalPages === "number") {
            setTotalPages(data.pagination.totalPages)
          }
        }
      })
      .catch((err) => console.error("Error loading services:", err))
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }, [selectedCategoryId, searchQuery, minPrice, maxPrice, minRating, sortBy, currentPage])

  // Auto-rotate hero banners (9s interval, paused on hover)
  useEffect(() => {
    if (banners.length <= 1 || bannerCarouselPaused) return
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [banners.length, bannerCarouselPaused])

  // Fetch Service Ads
  useEffect(() => {
    fetch("/api/home/ads?type=service")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setAds(data)
      })
      .catch((err) => console.error("Error loading service ads:", err))
  }, [])

  // Auto-advance sponsored service ads
  useEffect(() => {
    if (ads.length <= 1 || sponsoredCarouselPaused) return
    const timer = setInterval(() => {
      setSponsoredIndex((prev) => (prev + 1) % ads.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [ads.length, sponsoredCarouselPaused])

  // Scroll sponsored carousel to active index
  useEffect(() => {
    const el = sponsoredScrollRef.current
    if (!el || ads.length === 0) return
    const card = el.querySelector("[data-sponsored-card]")
    const gap = 16
    const cardWidth = (card?.getBoundingClientRect().width ?? 280) + gap
    el.scrollLeft = Math.min(sponsoredIndex * cardWidth, el.scrollWidth - el.clientWidth)
  }, [sponsoredIndex, ads.length])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set("search", searchQuery.trim())
    if (selectedCategoryId) params.set("serviceCategoryId", selectedCategoryId)
    if (minPrice) params.set("minPrice", minPrice)
    if (maxPrice) params.set("maxPrice", maxPrice)
    if (minRating) params.set("minRating", minRating)
    if (sortBy) params.set("sortBy", sortBy)
    params.set("limit", "30")
    params.set("page", "1")

    fetch(`/api/services?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => setServices(data.services || []))
      .finally(() => setLoading(false))
  }

  const handleResetFilters = () => {
    setCurrentPage(1)
    setSearchQuery("")
    setSelectedCategoryId("")
    setMinPrice("")
    setMaxPrice("")
    setMinRating("")
    setSortBy("newest")
  }

  const activeCategory = categories.find((c) => c.id === selectedCategoryId)
  const categoriesSumCount = categories.reduce((acc, cat) => acc + (cat.serviceCount || 0), 0)
  const staticTotalCount = totalAllServices > 0 ? totalAllServices : categoriesSumCount || services.length

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 text-slate-900">

      {/* 1. HERO BANNER CAROUSEL — Full-width container with clean unobscured banner & top badges */}
      <section
        className="relative w-full max-w-[100vw] bg-slate-900 overflow-hidden aspect-[16/5.2] sm:aspect-auto sm:h-[480px] md:h-[540px] lg:h-[600px]"
        onMouseEnter={() => setBannerCarouselPaused(true)}
        onMouseLeave={() => setBannerCarouselPaused(false)}
      >
        <div className="relative h-full w-full">
          {/* TOP LEFT COMPACT BADGE */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-6 z-20">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-slate-950/75 px-2.5 py-1 text-[9px] sm:text-[11px] font-extrabold text-amber-300 backdrop-blur-md shadow-md">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Verified On-Demand Services</span>
            </div>
          </div>

          {/* TOP RIGHT FEATURED SERVICE OFFER BADGE */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-6 z-20">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-1 text-[9px] sm:text-[10px] font-black text-slate-950 shadow-md uppercase tracking-wider border border-amber-300/50">
              <span>FEATURED OFFER</span>
            </div>
          </div>

          {banners.length > 0 ? (
            <div className="relative h-full w-full">
              <Link href={`/banner/${banners[bannerIndex]?.id}`} className="block h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banners[bannerIndex]?.mobileBanner || (banners[bannerIndex] as any)?.mobile_banner || banners[bannerIndex]?.bannerImage}
                  alt={banners[bannerIndex]?.bannerHeading || "Service Banner"}
                  className="w-full h-full object-cover object-top transition-all duration-700 ease-in-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-slate-950/30 pointer-events-none" />
              </Link>
            </div>
          ) : (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80"
                alt="Home Services Banner"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-slate-950/30 pointer-events-none" />
            </div>
          )}

          {/* Navigation Arrows */}
          {banners.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md border border-slate-100 transition-all hover:scale-105"
                aria-label="Previous banner"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                type="button"
                onClick={() => setBannerIndex((prev) => (prev + 1) % banners.length)}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md border border-slate-100 transition-all hover:scale-105"
                aria-label="Next banner"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBannerIndex(i)}
                    className={cn(
                      "h-1.5 sm:h-2 rounded-full transition-all duration-300",
                      bannerIndex === i ? "w-5 sm:w-6 bg-amber-500" : "w-1.5 sm:w-2 bg-white/70"
                    )}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. CATEGORY SPOTLIGHT CARDS — Placed cleanly BELOW the banner on mobile (mt-4), floating over banner on desktop (sm:-mt-32 md:-mt-44 lg:-mt-52) */}
      {(() => {
        const qualifiedCategories = categories
          .filter((cat) => {
            const dbCount = typeof cat.serviceCount === "number" ? cat.serviceCount : 0
            const loadedCount = spotlightServices.filter((s) => s.serviceCategory?.id === cat.id).length
            return dbCount >= 3 || loadedCount >= 3
          })
          .sort((a, b) => (b.serviceCount || 0) - (a.serviceCount || 0))

        if (qualifiedCategories.length === 0) return null

        return (
          <section className="container mx-auto px-3 sm:px-4 mt-4 sm:-mt-32 md:-mt-44 lg:-mt-52 relative z-20 pb-6 sm:pb-8 flex items-center justify-center">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 w-full max-w-7xl mx-auto">
              {qualifiedCategories.slice(0, 4).map((cat) => {
                const catServices = spotlightServices.filter((s) => s.serviceCategory?.id === cat.id).slice(0, 4)

                return (
                  <Card key={cat.id} className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-2xl flex flex-col justify-between">
                    <CardContent className="p-0 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm">
                            {getCategoryIcon(cat.name)}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                            {cat.name}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 flex-1">
                          {catServices.map((sItem, sIdx) => {
                            const imgUrl = Array.isArray(sItem.images) && typeof sItem.images[0] === "string"
                              ? sItem.images[0]
                              : "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=300&q=80"

                            return (
                              <Link
                                key={sItem.id || `cat_s_${sIdx}`}
                                href={`/service/${sItem.id}`}
                                className="group flex flex-col bg-slate-50/60 rounded-xl p-1.5 border border-slate-100 transition-all hover:bg-amber-50/50 hover:border-amber-200"
                              >
                                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgUrl}
                                    alt={sItem.name}
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-amber-600">
                                  {sItem.name}
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-600">
                                  {sItem.basePrice ? formatCurrency(sItem.basePrice) : "On Request"}
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPage(1)
                          setSelectedCategoryId(cat.id)
                          setTimeout(() => {
                            document.getElementById("services-catalog")?.scrollIntoView({ behavior: "smooth" })
                          }, 50)
                        }}
                        className="w-full mt-4 h-8 text-xs font-bold border-amber-300/80 bg-amber-50/60 text-amber-900 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-400 rounded-xl transition-all shadow-2xs"
                      >
                        See all {cat.name} services
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* 3. SEARCH BAR & TRUST BADGES SECTION */}
      <section className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-sm max-w-4xl mx-auto">
          {/* Compact Search Form */}
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl bg-slate-50 p-1.5 border border-slate-200">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search plumbing, cleaning, beauty, electrical, repair..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="h-10 border-0 bg-white pl-10 text-xs sm:text-sm font-medium shadow-2xs placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
                />
              </div>

              <Button
                type="submit"
                className="h-10 rounded-lg bg-amber-400 px-6 text-xs sm:text-sm font-bold text-slate-950 shadow-sm hover:bg-amber-500 shrink-0"
              >
                <Search className="mr-1.5 h-4 w-4" />
                Search
              </Button>
            </div>
          </form>

          {/* Compact Trust Badges */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>100% Verified Experts</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Flexible Scheduling</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Best Price Guarantee</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SLEEK COMPACT HORIZONTAL CATEGORY CAROUSEL (FILTER BAR) */}
      <section className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Categories</span>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Browse by Service Category
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {selectedCategoryId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCurrentPage(1)
                    setSelectedCategoryId("")
                  }}
                  className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                >
                  Clear Category
                  <X className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}

              {/* Category Scroll Arrow Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollCategories("left")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-400 hover:text-slate-950 transition-colors shadow-2xs"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCategories("right")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-400 hover:text-slate-950 transition-colors shadow-2xs"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontally Scrollable Category Pills Row */}
          <div
            ref={categoryScrollRef}
            className="flex gap-2.5 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* All Services Pill */}
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1)
                setSelectedCategoryId("")
                setTimeout(() => {
                  document.getElementById("services-catalog")?.scrollIntoView({ behavior: "smooth" })
                }, 50)
              }}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200 shrink-0 hover:scale-[1.02]",
                !selectedCategoryId
                  ? "border-amber-400 bg-amber-400/15 shadow-xs ring-2 ring-amber-400/30 text-amber-950 font-black"
                  : "border-slate-200 bg-slate-50/70 hover:border-amber-300 hover:bg-white text-slate-800"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm shadow-xs",
                !selectedCategoryId ? "bg-amber-400 text-slate-950" : "bg-white text-slate-800 border border-slate-200"
              )}>
                ✨
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block leading-tight">All Services</span>
                <span className="text-[10px] font-semibold text-slate-500">{staticTotalCount} items</span>
              </div>
            </button>

            {/* Individual Category Pills */}
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id
              const iconStr = getCategoryIcon(cat.name)

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCurrentPage(1)
                    setSelectedCategoryId(isSelected ? "" : cat.id)
                    setTimeout(() => {
                      document.getElementById("services-catalog")?.scrollIntoView({ behavior: "smooth" })
                    }, 50)
                  }}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200 shrink-0 hover:scale-[1.02]",
                    isSelected
                      ? "border-amber-400 bg-amber-400/15 shadow-xs ring-2 ring-amber-400/30 text-amber-950 font-black"
                      : "border-slate-200 bg-slate-50/70 hover:border-amber-300 hover:bg-white text-slate-800"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm shadow-xs",
                    isSelected ? "bg-amber-400 text-slate-950" : "bg-white text-slate-800 border border-slate-200"
                  )}>
                    {cat.image || cat.mobileIcon ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={cat.image || cat.mobileIcon!}
                        alt={cat.name}
                        className="h-6 w-6 object-contain"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.style.display = "none"
                          if (target.nextElementSibling) {
                            (target.nextElementSibling as HTMLElement).style.display = "inline-block"
                          }
                        }}
                      />
                    ) : null}
                    <span className={cn("text-sm", cat.image || cat.mobileIcon ? "hidden" : "inline-block")}>
                      {iconStr}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="text-xs font-bold block leading-tight max-w-[130px] truncate">{cat.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500">{cat.serviceCount ?? 0} available</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 5. 🔥 SPECIAL SERVICE DEALS & DISCOUNT SECTION — Strictly Dynamic */}
      {(() => {
        const discountedServices = spotlightServices.filter((s) => typeof s.discount === "number" && s.discount > 0)
        if (discountedServices.length === 0) return null

        return (
          <section className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-amber-300/70 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-orange-500/10 p-5 sm:p-7 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md text-xl">
                    🔥
                  </span>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                      Special Service Deals & Discounts
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      Limited-time promotional offers direct from verified service providers
                    </p>
                  </div>
                </div>

                <Badge className="bg-orange-500 text-white font-extrabold px-3.5 py-1 text-xs uppercase tracking-wider shadow-sm">
                  Promotional Deals
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {discountedServices.slice(0, 6).map((sItem, sIdx) => {
                  const discountAmt = sItem.discount || 0
                  const basePrice = sItem.basePrice || 0
                  const finalPrice = Math.max(0, basePrice - discountAmt)
                  const imgUrl = Array.isArray(sItem.images) && typeof sItem.images[0] === "string"
                    ? sItem.images[0]
                    : "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80"

                  return (
                    <Link
                      key={`deal_${sItem.id}_${sIdx}`}
                      href={`/service/${sItem.id}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-amber-400 hover:shadow-lg hover:-translate-y-1"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
                        <span className="absolute left-2 top-2 z-10 rounded-md bg-orange-500 text-white px-2 py-0.5 text-[10px] font-extrabold shadow-xs">
                          SAVE {formatCurrency(discountAmt)}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={sItem.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="mt-2.5 flex flex-col flex-1 justify-between space-y-2">
                        <div>
                          <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider truncate mb-0.5">
                            {sItem.seller?.store?.name || "Verified Professional"}
                          </p>
                          <p className="line-clamp-2 text-xs font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors leading-snug">
                            {sItem.name}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                            <div className="flex flex-col">
                              <span className="text-xs sm:text-sm font-black text-amber-600">
                                {formatCurrency(finalPrice)}
                              </span>
                              {basePrice > finalPrice && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  {formatCurrency(basePrice)}
                                </span>
                              )}
                            </div>

                            {sItem.rating && sItem.rating > 0 ? (
                              <div className="flex items-center gap-0.5 text-[10px] font-extrabold text-amber-600">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                <span>{sItem.rating.toFixed(1)}</span>
                              </div>
                            ) : null}
                          </div>

                          <Button
                            size="sm"
                            className="w-full mt-2 h-7 text-[11px] font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-xl transition-all shadow-xs"
                          >
                            Book Deal Now
                          </Button>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })()}

      {/* SPONSORED SERVICE ADS SECTION */}
      {ads.length > 0 && (
        <section
          className="container mx-auto px-4 py-5 sm:px-6 lg:px-8"
          onMouseEnter={() => setSponsoredCarouselPaused(true)}
          onMouseLeave={() => setSponsoredCarouselPaused(false)}
        >
          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black shadow-xs text-lg">
                  ⚡
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">Sponsored Service Promotions</h3>
                  <p className="text-xs text-slate-500 font-medium">Exclusive offers from verified service professionals</p>
                </div>
              </div>
            </div>

            <div className="relative">
                {ads.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSponsoredCarouselPaused(true)
                        setSponsoredIndex(prev => (prev <= 0 ? ads.length - 1 : prev - 1))
                      }}
                      className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white text-slate-900 shadow-md border border-slate-200 hover:bg-amber-400 hover:text-slate-950 transition-all hover:scale-105"
                      aria-label="Previous service ad"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSponsoredCarouselPaused(true)
                        setSponsoredIndex(prev => (prev >= ads.length - 1 ? 0 : prev + 1))
                      }}
                      className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white text-slate-900 shadow-md border border-slate-200 hover:bg-amber-400 hover:text-slate-950 transition-all hover:scale-105"
                      aria-label="Next service ad"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                <div
                  ref={sponsoredScrollRef}
                  className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth py-1.5 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  style={{ scrollBehavior: sponsoredCarouselPaused ? "auto" : "smooth" }}
                >
                  {ads.map((ad) => {
                    const adPageHref = `/api/ads/click?adId=${ad.id}&redirect_to_ad=true`
                    const imgUrl = getYoutubeThumbnailUrl(ad.creativeUrl) || ad.creativeUrl || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80"
                    return (
                      <Link
                        key={ad.id}
                        href={adPageHref}
                        data-sponsored-card
                        onClick={() => setSponsoredCarouselPaused(true)}
                        className="group flex w-[80vw] min-w-[270px] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-xs hover:border-amber-400 hover:shadow-md transition-all"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={ad.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute top-2 left-2">
                            <span className="rounded-full bg-slate-950/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black text-amber-300 uppercase tracking-widest border border-amber-400/30">
                              Service Ad
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col p-4 space-y-1 bg-white">
                          <span className="font-extrabold text-slate-900 line-clamp-1 group-hover:text-amber-600 transition-colors text-sm">
                            {ad.title}
                          </span>
                          {ad.description?.trim() && (
                            <p className="line-clamp-2 text-xs text-slate-500 leading-relaxed font-medium">
                              {ad.description}
                            </p>
                          )}
                          <span className="mt-2 inline-flex items-center text-xs font-bold text-amber-600 group-hover:underline">
                            View Offer
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

      {/* 4. FOURTH: MAIN SERVICES & FILTERS CONTAINER ("now present") */}
      <section id="services-catalog" className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          {/* SEARCH & FILTER CONTROLS BAR */}
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-slate-800">Filter & Sort</span>
              </div>

              {/* Price Min/Max Inputs */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min NLe"
                  value={minPrice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinPrice(e.target.value)}
                  className="h-9 w-24 rounded-lg border-slate-200 text-xs focus-visible:ring-amber-500 font-medium"
                />
                <span className="text-xs text-slate-400">-</span>
                <Input
                  type="number"
                  placeholder="Max NLe"
                  value={maxPrice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxPrice(e.target.value)}
                  className="h-9 w-24 rounded-lg border-slate-200 text-xs focus-visible:ring-amber-500 font-medium"
                />
              </div>

              {/* Rating Select */}
              <Select value={minRating} onValueChange={(val: string) => setMinRating(val === "all" ? "" : val)}>
                <SelectTrigger className="h-9 w-[130px] rounded-lg border-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Rating</SelectItem>
                  <SelectItem value="4.5">★ 4.5 & Above</SelectItem>
                  <SelectItem value="4.0">★ 4.0 & Above</SelectItem>
                  <SelectItem value="3.5">★ 3.5 & Above</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sorting Select */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Sort By:</span>
              <Select value={sortBy} onValueChange={(val: string) => setSortBy(val)}>
                <SelectTrigger className="h-9 w-[160px] rounded-lg border-slate-200 text-xs font-bold text-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ACTIVE FILTER BADGES */}
          {(searchQuery || selectedCategoryId || minPrice || maxPrice || minRating) && (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
              <span className="text-xs font-semibold text-slate-500">Active Filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 bg-white text-xs text-slate-700 shadow-sm">
                  Search: "{searchQuery}"
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
              {activeCategory && (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-xs text-amber-900 shadow-sm">
                  Category: {activeCategory.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategoryId("")} />
                </Badge>
              )}
              {(minPrice || maxPrice) && (
                <Badge variant="secondary" className="gap-1 bg-white text-xs text-slate-700 shadow-sm">
                  Price: ${minPrice || "0"} - ${maxPrice || "∞"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setMinPrice(""); setMaxPrice("") }} />
                </Badge>
              )}
              {minRating && (
                <Badge variant="secondary" className="gap-1 bg-white text-xs text-slate-700 shadow-sm">
                  Rating: ★ {minRating}+
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setMinRating("")} />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-6 px-2 text-[11px] font-bold text-amber-600 hover:bg-amber-50"
              >
                Reset All
              </Button>
            </div>
          )}

          {/* SERVICE CATALOG GRID */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="h-44 rounded-xl bg-slate-200" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
                  <div className="mt-4 flex items-center justify-between">
                    <div className="h-5 w-20 rounded bg-slate-200" />
                    <div className="h-8 w-24 rounded-lg bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : services.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {services.map((service) => {
                  const coverImg = Array.isArray(service.images) && service.images.length > 0
                    ? service.images[0]
                    : typeof service.images === "string"
                      ? service.images
                      : "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80"

                  const storeName = service.seller?.store?.name || "Verified Professional"
                  const categoryName = service.serviceCategory?.name || "General Service"

                  return (
                    <Card
                      key={service.id}
                      className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl"
                    >
                      {/* Card Image Header */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverImg}
                          alt={service.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60" />

                        {/* Top Badges */}
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          <Badge className="bg-slate-900/80 text-[10px] font-semibold text-white backdrop-blur-md">
                            {categoryName}
                          </Badge>
                          {service.isFeatured && (
                            <Badge className="bg-amber-400 text-[10px] font-bold text-slate-950">
                              Featured
                            </Badge>
                          )}
                        </div>

                        {/* Rating / New Badge */}
                        {service.rating && service.rating > 0 ? (
                          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-900 backdrop-blur-md shadow-sm">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span>{service.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-slate-500">({service.reviewCount || 0})</span>
                          </div>
                        ) : (
                          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-slate-950/75 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300 backdrop-blur-md border border-amber-400/30 shadow-sm">
                            <span>New Service</span>
                          </div>
                        )}
                      </div>

                      {/* Card Content Body */}
                      <CardContent className="p-4">
                        {/* Provider Store Name */}
                        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Store className="h-3.5 w-3.5 text-amber-600" />
                          <span className="truncate font-medium">{storeName}</span>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        </div>

                        {/* Title */}
                        <h3 className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                          <Link href={`/service/${service.id}`}>
                            {service.name}
                          </Link>
                        </h3>

                        {/* Duration Indicator if present */}
                        {service.duration && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>Est. {service.duration} mins</span>
                          </div>
                        )}

                        {/* Price & Action */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Starting at</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-extrabold text-slate-900">
                                {service.basePrice ? formatCurrency(service.basePrice) : "Custom Quote"}
                              </span>
                              {service.discount && service.discount > 0 ? (
                                <span className="text-xs font-semibold text-emerald-600">
                                  (Save {formatCurrency(service.discount)})
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <Link href={`/service/${service.id}`}>
                            <Button size="sm" className="rounded-xl bg-slate-900 font-bold text-white shadow-sm hover:bg-amber-500 hover:text-slate-950 transition-colors">
                              Book Now
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* SEE MORE / LOAD MORE 50 SERVICES BUTTON */}
              <div className="mt-10 flex flex-col items-center justify-center gap-3 pt-6 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500">
                  Showing {services.length} of {totalAllServices} services
                </p>

                {currentPage < totalPages ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={loadingMore}
                    className="h-11 px-8 rounded-2xl bg-amber-400 text-slate-950 font-black hover:bg-amber-500 shadow-md transition-all text-sm flex items-center gap-2 cursor-pointer"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                        <span>Loading More Services...</span>
                      </>
                    ) : (
                      <>
                        <span>See More Services (50 more)</span>
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-extrabold text-slate-600 border border-slate-200">
                    ✨ Showing all {services.length} services
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="my-12 flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <Wrench className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Services Found</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                We couldn't find any services matching your search or filters. Try adjusting your search criteria or resetting filters.
              </p>
              <Button
                onClick={handleResetFilters}
                className="mt-4 rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-500"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 5. PLATFORM TRUST & QUALITY GUARANTEE BANNER */}
      <section className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md text-xl">
                🛡️
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-white">Escrow Payment Protection</h4>
                <p className="text-xs text-slate-300 font-medium">Funds released only after 100% job completion</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md text-xl">
                ⚡
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-white">Background Checked Experts</h4>
                <p className="text-xs text-slate-300 font-medium">Fully vetted professionals for your peace of mind</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md text-xl">
                🏆
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-white">Quality Satisfaction Guarantee</h4>
                <p className="text-xs text-slate-300 font-medium">Free re-service if you are not completely satisfied</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md text-xl">
                📞
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-white">24/7 Dedicated Support</h4>
                <p className="text-xs text-slate-300 font-medium">Round-the-clock help for booking and inquiries</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function ServiceHomeClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Loading services...</p>
        </div>
      }
    >
      <ServiceHomeContent />
    </Suspense>
  )
}
