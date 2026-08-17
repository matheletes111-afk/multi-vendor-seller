"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, Star, MapPin, SlidersHorizontal, RefreshCw, Eye, ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { PublicLayout } from "@/components/site-layout"
import { formatCurrency, extractFoodImages, cn } from "@/lib/utils"
import { getYoutubeThumbnailUrl } from "@/lib/youtube"

type Room = {
  id: string
  name: string
  price: number
}

type Hotel = {
  id: string
  name: string
  description: string | null
  starRating: number
  address: string | null
  city: string | null
  state: string | null
  images: any
  logo: string | null
  rooms: Room[]
}

const CITY_ICONS: Record<string, string> = {
  freetown: "🏙️",
  bo: "🌴",
  kenema: "⛰️",
  makeni: "🌆",
  koidu: "💎",
  lunsar: "🏞️",
  waterloo: "🌊",
  "port loko": "⛵",
  luxury: "🏨",
  beach: "🏖️",
  resort: "🏝️",
  boutique: "🏰",
  business: "🏢",
  budget: "🏡",
  villa: "🏯",
}

const RANDOM_CITY_ICONS = ["🏙️", "🏨", "🌴", "⛰️", "🏖️", "🏰", "🏢", "🏡", "🏯", "🌅", "🌆", "⛵", "🌊", "🏝️"]

function getCityIcon(cityName: string): string {
  const lower = cityName.toLowerCase()
  for (const [key, icon] of Object.entries(CITY_ICONS)) {
    if (lower.includes(key)) return icon
  }
  let hash = 0
  for (let i = 0; i < cityName.length; i++) hash += cityName.charCodeAt(i)
  return RANDOM_CITY_ICONS[hash % RANDOM_CITY_ICONS.length]
}

function HotelsBrowsePageContent() {
  const searchParams = useSearchParams()
  const initialQ = searchParams?.get("q") || ""
  const initialCity = searchParams?.get("city") || ""

  const [hotels, setHotels] = useState<Hotel[]>([])
  const [allHotels, setAllHotels] = useState<Hotel[]>([])
  const [spotlightCity1, setSpotlightCity1] = useState<string>("")
  const [spotlightCity2, setSpotlightCity2] = useState<string>("")
  const [cities, setCities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [selectedCity, setSelectedCity] = useState(initialCity)

  // Fetch all hotels once to establish spotlight cities (with min 4 hotels) and card collections
  useEffect(() => {
    fetch("/api/hotels")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          const list = data.data as Hotel[]
          setAllHotels(list)

          // Group hotels by city to find cities with >= 4 hotels
          const cityMap: Record<string, Hotel[]> = {}
          list.forEach((h) => {
            if (h.city && h.city.trim()) {
              const cName = h.city.trim()
              if (!cityMap[cName]) cityMap[cName] = []
              cityMap[cName].push(h)
            }
          })

          const citiesWithMin4 = Object.keys(cityMap).filter((c) => cityMap[c].length >= 4)
          const allAvailableCities = Object.keys(cityMap)

          let c1 = ""
          let c2 = ""

          if (citiesWithMin4.length >= 2) {
            const shuffled = [...citiesWithMin4].sort(() => 0.5 - Math.random())
            c1 = shuffled[0]
            c2 = shuffled[1]
          } else if (citiesWithMin4.length === 1) {
            c1 = citiesWithMin4[0]
            const remaining = allAvailableCities.filter((c) => c.toLowerCase() !== c1.toLowerCase())
            if (remaining.length > 0) {
              c2 = remaining[Math.floor(Math.random() * remaining.length)]
            }
          } else if (allAvailableCities.length >= 2) {
            const shuffled = [...allAvailableCities].sort(() => 0.5 - Math.random())
            c1 = shuffled[0]
            c2 = shuffled[1]
          } else if (allAvailableCities.length === 1) {
            c1 = allAvailableCities[0]
          }

          setSpotlightCity1(c1 || "Mumbai")
          setSpotlightCity2(c2 || "Goa")
        }
      })
      .catch((err) => console.error("Error fetching spotlight hotels:", err))
  }, [])

  // Card 1: 4 Hotels from Spotlight City 1
  const city1Hotels = useMemo(() => {
    if (!spotlightCity1) return allHotels.slice(0, 4)
    const matching = allHotels.filter((h) => h.city?.toLowerCase() === spotlightCity1.toLowerCase())
    if (matching.length >= 4) return matching.slice(0, 4)
    const others = allHotels.filter((h) => h.city?.toLowerCase() !== spotlightCity1.toLowerCase())
    return [...matching, ...others].slice(0, 4)
  }, [allHotels, spotlightCity1])

  // Card 2: 4 Hotels from Spotlight City 2
  const city2Hotels = useMemo(() => {
    if (!spotlightCity2) return allHotels.slice(4, 8)
    const matching = allHotels.filter((h) => h.city?.toLowerCase() === spotlightCity2.toLowerCase())
    if (matching.length >= 4) return matching.slice(0, 4)
    const others = allHotels.filter((h) => h.city?.toLowerCase() !== spotlightCity2.toLowerCase())
    return [...matching, ...others].slice(0, 4)
  }, [allHotels, spotlightCity2])

  // Card 3: Top Rated > 3-Star Hotels
  const luxury3StarPlusHotels = useMemo(() => {
    const matching = allHotels.filter((h) => h.starRating > 3)
    if (matching.length >= 4) return matching.slice(0, 4)
    return [...allHotels].sort((a, b) => b.starRating - a.starRating).slice(0, 4)
  }, [allHotels])

  // Card 4: Featured Resorts & Heritage Havelis
  const resortHeritageHotels = useMemo(() => {
    const keywords = ["resort", "villa", "haveli", "palace", "spa", "haven", "beach"]
    const matching = allHotels.filter((h) => {
      const text = (h.name + " " + (h.description || "")).toLowerCase()
      return keywords.some((k) => text.includes(k))
    })
    if (matching.length >= 4) return matching.slice(0, 4)
    return allHotels.slice(0, 4)
  }, [allHotels])

  const cityScrollRef = useRef<HTMLDivElement>(null)

  const scrollCityCategories = (direction: "left" | "right") => {
    if (cityScrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300
      cityScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }

  const cityCategories = cities.map((c) => ({
    name: c,
    isCity: true,
    count: hotels.filter((h) => h.city?.toLowerCase() === c.toLowerCase()).length,
  }))

  useEffect(() => {
    setSearchQuery(initialQ)
    setSelectedCity(initialCity)
  }, [initialQ, initialCity])
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [banners, setBanners] = useState<any[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  const [bannersLoading, setBannersLoading] = useState(true)

  // Load hotel banners
  useEffect(() => {
    setBannersLoading(true)
    fetch("/api/home/banners?targetType=hotel")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const hotelBanners = data.filter((b: any) => b.targetType === "hotel")
          setBanners(hotelBanners)
        }
      })
      .catch(err => console.error("Error loading hotel banners:", err))
      .finally(() => setBannersLoading(false))
  }, [])

  // Auto scroll banners
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setCurrentBannerIdx(prev => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners])

  const [ads, setAds] = useState<any[]>([])
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false)
  const [sponsoredIndex, setSponsoredIndex] = useState(0)
  const sponsoredScrollRef = useRef<HTMLDivElement>(null)

  // Fetch hotel ads
  useEffect(() => {
    fetch("/api/home/ads?type=hotel")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAds(data)
      })
      .catch(err => console.error("Error loading hotel ads:", err))
  }, [])

  // Auto advance sponsored ads
  useEffect(() => {
    if (ads.length <= 1 || sponsoredCarouselPaused) return
    const timer = setInterval(() => {
      setSponsoredIndex(prev => (prev + 1) % ads.length)
    }, 3000)
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

  // Sync sponsored index on manual scroll
  useEffect(() => {
    const el = sponsoredScrollRef.current
    if (!el || ads.length <= 1) return
    const onScroll = () => {
      const card = el.querySelector("[data-sponsored-card]")
      const gap = 16
      const cardWidth = (card?.getBoundingClientRect().width ?? 280) + gap
      const index = Math.round(el.scrollLeft / cardWidth)
      setSponsoredIndex(Math.min(index, ads.length - 1))
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [ads.length])

  const [initialLoading, setInitialLoading] = useState(true)

  const fetchHotels = async () => {
    setLoading(true)
    try {
      let url = "/api/hotels?"
      if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`
      if (selectedCity) url += `city=${encodeURIComponent(selectedCity)}&`
      if (selectedRating !== null) url += `rating=${selectedRating}&`
      if (minPrice) url += `minPrice=${encodeURIComponent(minPrice)}&`
      if (maxPrice) url += `maxPrice=${encodeURIComponent(maxPrice)}&`

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setHotels(data.data)
        if (data.cities) {
          setCities(data.cities)
        }
      }
    } catch (error) {
      console.error("Failed to load hotels:", error)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const [visibleCount, setVisibleCount] = useState<number>(50)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  useEffect(() => {
    setVisibleCount(50)
    fetchHotels()
  }, [searchQuery, selectedCity, selectedRating])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHotels()
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 pb-12">
      {initialLoading ? (
        <div className="flex min-h-[70vh] items-center justify-center">
          <PageLoader message="Loading…" />
        </div>
      ) : (
        <>
          {/* 1. HERO BANNERS CAROUSEL SECTION (Matches Marketplace & Service design) */}
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 pt-0">
        <section
          className="relative w-full overflow-hidden bg-slate-900 rounded-none shadow-md aspect-[16/4.8] sm:aspect-[16/6.6] min-h-[130px] sm:min-h-[240px] border border-slate-200/60"
          onMouseEnter={() => setSponsoredCarouselPaused(true)}
          onMouseLeave={() => setSponsoredCarouselPaused(false)}
        >
          {bannersLoading ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
              <div className="h-9 w-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-bold text-amber-200/80 animate-pulse uppercase tracking-wider">Loading Banners...</span>
            </div>
          ) : banners.length > 0 ? (
            <>
              <div className="relative w-full h-full overflow-hidden">
                {banners.map((banner, i) => (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      i === currentBannerIdx ? "opacity-100 z-10" : "opacity-0 z-0"
                    }`}
                  >
                    <Link href={`/banner/${banner.id}`} className="block size-full relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={banner.mobileBanner || (banner as any).mobile_banner || banner.bannerImage}
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
                    onClick={() => setCurrentBannerIdx((i) => (i - 1 + banners.length) % banners.length)}
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full shadow-md bg-white/80 text-slate-900 hover:bg-white sm:right-4 sm:h-11 sm:w-11"
                    onClick={() => setCurrentBannerIdx((i) => (i + 1) % banners.length)}
                  >
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 sm:bottom-4">
                    {banners.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentBannerIdx(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 sm:h-2 ${
                          currentBannerIdx === idx ? "w-5 bg-emerald-500 sm:w-6" : "w-1.5 bg-white/70 sm:w-2"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Fallback Hero Banner when no banners in DB */
            <div className="relative w-full h-full flex flex-col justify-center px-6 sm:px-12 bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-950 text-white">
              <div className="max-w-2xl space-y-3 z-10">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-400/30">
                  🏨 Discover Handpicked Stays
                </span>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                  Book Top Hotels, Resorts & Luxury Suites
                </h1>
                <p className="text-slate-300 text-sm sm:text-base max-w-xl font-medium">
                  Explore curated 4★ & 5★ luxury properties across top destinations with instant confirmation.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 2. FEATURED 4-COLLECTION CARDS — Overlapping lower 30% area of hero banner (Identical to Marketplace & Service UI) */}
      {allHotels.length > 0 && (
        <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 mt-4 sm:-mt-28 md:-mt-32 lg:-mt-36 xl:-mt-40 relative z-20 pb-6 sm:pb-8 flex items-center justify-center">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 w-full">
            
            {/* CARD 1: City Spotlight #1 (min 4 hotels) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-emerald-100 text-sm">
                      📍
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Hotels in {spotlightCity1 || "Mumbai"}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {city1Hotels.map((hotel, sIdx) => {
                      const extracted = extractFoodImages(hotel.images)
                      const imgUrl = extracted[0] || hotel.logo || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300&q=80"
                      const minRoomPrice = hotel.rooms && hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map((r) => r.price)) : null

                      return (
                        <Link
                          key={hotel.id || `c1_h_${sIdx}`}
                          href={`/hotels/${hotel.id}`}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-emerald-50/50 hover:border-emerald-200"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={hotel.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600">
                            {hotel.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="text-amber-600 font-extrabold">⭐ {hotel.starRating}★</span>
                            {minRoomPrice ? <span className="font-bold text-slate-700">{formatCurrency(minRoomPrice)}</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                <Link
                  href={`/hotels?city=${encodeURIComponent(spotlightCity1)}`}
                  className="mt-4 block text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  See all in {spotlightCity1} →
                </Link>
              </CardContent>
            </Card>

            {/* CARD 2: City Spotlight #2 (min 4 hotels) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-emerald-100 text-sm">
                      🌆
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Discover {spotlightCity2 || "Goa"} Stays
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {city2Hotels.map((hotel, sIdx) => {
                      const extracted = extractFoodImages(hotel.images)
                      const imgUrl = extracted[0] || hotel.logo || "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=300&q=80"
                      const minRoomPrice = hotel.rooms && hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map((r) => r.price)) : null

                      return (
                        <Link
                          key={hotel.id || `c2_h_${sIdx}`}
                          href={`/hotels/${hotel.id}`}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-emerald-50/50 hover:border-emerald-200"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={hotel.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600">
                            {hotel.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="text-amber-600 font-extrabold">⭐ {hotel.starRating}★</span>
                            {minRoomPrice ? <span className="font-bold text-slate-700">{formatCurrency(minRoomPrice)}</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                <Link
                  href={`/hotels?city=${encodeURIComponent(spotlightCity2)}`}
                  className="mt-4 block text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  See all in {spotlightCity2} →
                </Link>
              </CardContent>
            </Card>

            {/* CARD 3: Top Rated > 3-Star Hotels */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-amber-100 text-sm">
                      👑
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Top 4★ & 5★ Luxury Stays
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {luxury3StarPlusHotels.map((hotel, sIdx) => {
                      const extracted = extractFoodImages(hotel.images)
                      const imgUrl = extracted[0] || hotel.logo || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=300&q=80"
                      const minRoomPrice = hotel.rooms && hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map((r) => r.price)) : null

                      return (
                        <Link
                          key={hotel.id || `c3_h_${sIdx}`}
                          href={`/hotels/${hotel.id}`}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-amber-50/50 hover:border-amber-200"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={hotel.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-amber-600">
                            {hotel.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="text-amber-600 font-extrabold">⭐ {hotel.starRating}★</span>
                            {minRoomPrice ? <span className="font-bold text-slate-700">{formatCurrency(minRoomPrice)}</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                <Link
                  href="/hotels?rating=4"
                  className="mt-4 block text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
                >
                  View all 4★ & 5★ Hotels →
                </Link>
              </CardContent>
            </Card>

            {/* CARD 4: Featured Resorts & Heritage Havelis */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-teal-100 text-sm">
                      🏝️
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Resorts & Heritage Stays
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {resortHeritageHotels.map((hotel, sIdx) => {
                      const extracted = extractFoodImages(hotel.images)
                      const imgUrl = extracted[0] || hotel.logo || "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=300&q=80"
                      const minRoomPrice = hotel.rooms && hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map((r) => r.price)) : null

                      return (
                        <Link
                          key={hotel.id || `c4_h_${sIdx}`}
                          href={`/hotels/${hotel.id}`}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-teal-50/50 hover:border-teal-200"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={hotel.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-teal-600">
                            {hotel.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="text-amber-600 font-extrabold">⭐ {hotel.starRating}★</span>
                            {minRoomPrice ? <span className="font-bold text-slate-700">{formatCurrency(minRoomPrice)}</span> : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                <Link
                  href="/hotels?q=Resort"
                  className="mt-4 block text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
                >
                  Explore Resorts & Havelis →
                </Link>
              </CardContent>
            </Card>

          </div>
        </section>
      )}

      {/* 3. HERO SEARCH & BROWSE CONTENT CONTAINER */}
      <div className="container mx-auto px-4 sm:px-8 py-4 max-w-7xl space-y-10">
        
        {/* Hero Search Bar Section */}
        <div className="text-center space-y-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Find Your Perfect <span className="text-emerald-600">Hotel Stay</span>
          </h1>
          <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Discover handpicked luxury hotels, cozy suites, and local guest houses with secure escrow bookings.
          </p>

          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mt-4 flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by hotel name, description, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 border-0 bg-transparent h-11 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 placeholder-slate-400 text-sm sm:text-base"
              />
            </div>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 h-11 font-bold shadow-md shadow-emerald-500/10 shrink-0">
              Search
            </Button>
          </form>
        </div>

        {/* SPONSORED STAY SPOTLIGHT (Matching Marketplace Top Ad Section UI) */}
        {ads.length > 0 && (() => {
          const activeAd = ads[sponsoredIndex] || ads[0]
          if (!activeAd) return null
          const adPageHref = `/api/ads/click?adId=${activeAd.id}&redirect_to_ad=true`

          return (
            <div className="relative overflow-hidden rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/10 p-5 sm:p-8 shadow-xl my-6">
              <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center relative z-10">
                {/* Left: Video / Banner Creative */}
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900/10 shadow-lg md:col-span-6 lg:col-span-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getYoutubeThumbnailUrl(activeAd.creativeUrl) || activeAd.creativeUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80"}
                    alt={activeAd.title}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                    <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                      ★ Sponsored Stay Spotlight
                    </span>
                  </div>
                </div>

                {/* Right: Info & Action */}
                <div className="flex flex-col justify-between md:col-span-6 lg:col-span-7 space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-bold text-emerald-800">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Featured Property Offer
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                        Verified Ad
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 leading-snug tracking-tight">
                      {activeAd.title}
                    </h3>

                    {activeAd.description?.trim() && (
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium line-clamp-2">
                        {activeAd.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Link href={adPageHref}>
                      <Button className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md transition-all text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>Book Featured Stay</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

      {/* SLEEK COMPACT HORIZONTAL CITY / CATEGORY CAROUSEL */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Explore Locations</span>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              Browse Hotels by City & Category
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {(selectedCity || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCity("")
                  setSearchQuery("")
                }}
                className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
              >
                Clear Location
                <X className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}

            {/* Scroll Arrow Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollCityCategories("left")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-600 hover:text-white transition-colors shadow-2xs"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCityCategories("right")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-600 hover:text-white transition-colors shadow-2xs"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontally Scrollable Pills Row */}
        <div
          ref={cityScrollRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* All Locations Pill */}
          <button
            type="button"
            onClick={() => {
              setSelectedCity("")
              setSearchQuery("")
            }}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200 shrink-0 hover:scale-[1.02]",
              !selectedCity && !searchQuery
                ? "border-emerald-500 bg-emerald-500/15 shadow-xs ring-2 ring-emerald-500/30 text-emerald-950 font-black"
                : "border-slate-200 bg-slate-50/70 hover:border-emerald-300 hover:bg-white text-slate-800"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm shadow-xs",
              !selectedCity && !searchQuery ? "bg-emerald-600 text-white" : "bg-white text-slate-800 border border-slate-200"
            )}>
              🌐
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block leading-tight">All Locations</span>
              <span className="text-[10px] font-semibold text-slate-500">{hotels.length} hotels</span>
            </div>
          </button>

          {/* Individual City / Category Pills */}
          {cityCategories.map((cItem) => {
            const isSelected = selectedCity.toLowerCase() === cItem.name.toLowerCase() || searchQuery.toLowerCase() === cItem.name.toLowerCase()
            const iconStr = getCityIcon(cItem.name)

            return (
              <button
                key={cItem.name}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedCity("")
                    setSearchQuery("")
                  } else if (cItem.isCity) {
                    setSelectedCity(cItem.name)
                    setSearchQuery("")
                  } else {
                    setSearchQuery(cItem.name)
                    setSelectedCity("")
                  }
                }}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200 shrink-0 hover:scale-[1.02]",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/15 shadow-xs ring-2 ring-emerald-500/30 text-emerald-950 font-black"
                    : "border-slate-200 bg-slate-50/70 hover:border-emerald-300 hover:bg-white text-slate-800"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base shadow-xs transition-transform group-hover:scale-110",
                  isSelected ? "bg-emerald-600 text-white" : "bg-white text-slate-800 border border-slate-200"
                )}>
                  {iconStr}
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block leading-tight">{cItem.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {cItem.count > 0 ? `${cItem.count} ${cItem.count === 1 ? 'hotel' : 'hotels'}` : 'Browse'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="font-extrabold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Filters
              </span>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCity("")
                  setSelectedRating(null)
                  setMinPrice("")
                  setMaxPrice("")
                }}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Clear All
              </button>
            </div>

            {/* Price Range Filter */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <label className="text-sm font-bold text-slate-700">Price Range (per night)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-800 text-sm focus-visible:ring-emerald-500/20"
                />
                <span className="text-slate-400 font-bold">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-800 text-sm focus-visible:ring-emerald-500/20"
                />
              </div>
              <Button
                onClick={fetchHotels}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 font-bold text-xs tracking-wider uppercase shadow-md shrink-0 mt-2"
              >
                Apply Price
              </Button>
            </div>

            {/* City Filter */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <label className="text-sm font-bold text-slate-700">Destination City</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
              >
                <option value="">All Destinations</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Star Rating Filter */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Minimum Rating</label>
              <div className="flex flex-col gap-2">
                {[5, 4, 3, 2].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setSelectedRating(selectedRating === stars ? null : stars)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      selectedRating === stars
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-700"
                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex text-amber-400">
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current shrink-0" />
                      ))}
                    </div>
                    <span>& Up</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hotels Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
              <p className="text-slate-400 font-semibold text-sm">Searching for properties...</p>
            </div>
          ) : hotels.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
              <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">No Hotels Found</h3>
              <p className="text-slate-500 text-sm font-medium mb-4">Try relaxing your search terms or filters to find properties.</p>
              <Button onClick={() => { setSearchQuery(""); setSelectedCity(""); setSelectedRating(null); }} className="bg-slate-900 text-white rounded-xl">Reset Search</Button>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {hotels.slice(0, visibleCount).map((hotel) => {
                  const images = Array.isArray(hotel.images) ? hotel.images : []
                  const coverImage = images[0] || "/images/placeholder-hotel.jpg"
                  const startingPrice = hotel.rooms[0]?.price || 0

                  return (
                    <Card key={hotel.id} className="rounded-[2rem] overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full group bg-white">
                      <Link href={`/hotels/${hotel.id}`} className="relative aspect-[4/3] bg-slate-100 overflow-hidden shrink-0 block cursor-pointer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverImage}
                          alt={hotel.name}
                          className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          <span>{hotel.starRating || "N/A"} Star</span>
                        </div>
                      </Link>

                      <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-1.5 text-xs font-semibold text-emerald-600">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{hotel.city || "Sierra Leone"}</span>
                          </div>

                          <Link href={`/hotels/${hotel.id}`} className="block group-hover:text-emerald-700 transition-colors">
                            <h3 className="text-lg font-black text-slate-900 leading-tight line-clamp-1">{hotel.name}</h3>
                          </Link>

                          <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed">{hotel.description}</p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Starting at</p>
                            <p className="text-xl font-black text-emerald-600">{formatCurrency(startingPrice)}<span className="text-xs font-semibold text-slate-400">/night</span></p>
                          </div>

                          <Link href={`/hotels/${hotel.id}`}>
                            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-4 flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
                              <Eye className="h-3.5 w-3.5" /> Details
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* SEE MORE / LOAD MORE 50 HOTELS BUTTON */}
              <div className="mt-10 flex flex-col items-center justify-center gap-3 pt-6 border-t border-slate-200/80">
                {visibleCount < hotels.length ? (
                  <>
                    <p className="text-xs font-bold text-slate-500">
                      Showing {Math.min(visibleCount, hotels.length)} of {hotels.length} hotels
                    </p>

                    <Button
                      type="button"
                      onClick={() => {
                        setLoadingMore(true)
                        setTimeout(() => {
                          setVisibleCount((prev) => prev + 50)
                          setLoadingMore(false)
                        }, 300)
                      }}
                      disabled={loadingMore}
                      className="h-11 px-8 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 shadow-md transition-all text-sm flex items-center gap-2 cursor-pointer"
                    >
                      {loadingMore ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-white" />
                          <span>Loading More Hotels...</span>
                        </>
                      ) : (
                        <>
                          <span>See More Hotels (50 more)</span>
                          <ChevronRight className="h-4 w-4 rotate-90" />
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-extrabold text-emerald-700 border border-emerald-200/80">
                    ✨ Showing all {hotels.length} hotels
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sponsored Ads Section */}
      {ads.length > 0 && (
        <section
          className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-6"
          onMouseEnter={() => setSponsoredCarouselPaused(true)}
          onMouseLeave={() => setSponsoredCarouselPaused(false)}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Sponsored Stays</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-500/20">
              {ads.length} {ads.length === 1 ? "ad" : "ads"}
            </span>
          </div>
          <div className="relative">
            {ads.length > 1 && (
              <>
                <button
                  onClick={() => {
                    setSponsoredCarouselPaused(true)
                    setSponsoredIndex(prev => (prev <= 0 ? ads.length - 1 : prev - 1))
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-15 p-2 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md border border-slate-100 transition-all hover:scale-105"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSponsoredCarouselPaused(true)
                    setSponsoredIndex(prev => (prev >= ads.length - 1 ? 0 : prev + 1))
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-15 p-2 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md border border-slate-100 transition-all hover:scale-105"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <div
              ref={sponsoredScrollRef}
              className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth py-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollBehavior: sponsoredCarouselPaused ? "auto" : "smooth" }}
            >
              {ads.map((ad) => {
                const adPageHref = `/api/ads/click?adId=${ad.id}&redirect_to_ad=true`
                return (
                  <Link
                    key={ad.id}
                    href={adPageHref}
                    data-sponsored-card
                    onClick={() => setSponsoredCarouselPaused(true)}
                    className="group flex w-[80vw] min-w-[260px] max-w-[290px] shrink-0 snap-start flex-col overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-50/50 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                      {ad.creativeUrl ? (
                        <img
                          src={getYoutubeThumbnailUrl(ad.creativeUrl) || ad.creativeUrl}
                          alt={ad.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-102"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400 font-bold text-xs bg-slate-100">Ad Design</div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <span className="rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-widest">
                          Sponsored
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4 space-y-1 bg-white">
                      <span className="font-black text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors text-sm">
                        {ad.title}
                      </span>
                      {ad.description?.trim() && (
                        <p className="line-clamp-2 text-[11px] text-slate-500 leading-normal font-medium">
                          {ad.description}
                        </p>
                      )}
                      <span className="mt-2 inline-flex text-xs font-bold text-emerald-600 group-hover:underline">
                        Book Now →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}
          </div>
        </>
      )}
    </div>
  )
}

export default function HotelsBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <PageLoader message="Loading…" />
        </div>
      }
    >
      <HotelsBrowsePageContent />
    </Suspense>
  )
}
