"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Search, Star, MapPin, SlidersHorizontal, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"

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

export default function HotelsBrowsePage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [banners, setBanners] = useState<any[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  // Load hotel banners
  useEffect(() => {
    fetch("/api/home/banners")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const hotelBanners = data.filter((b: any) => b.targetType === "hotel")
          setBanners(hotelBanners)
        }
      })
      .catch(err => console.error("Error loading hotel banners:", err))
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
    }
  }

  useEffect(() => {
    fetchHotels()
  }, [selectedCity, selectedRating])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHotels()
  }

  return (
    <div className="container mx-auto px-4 sm:px-8 py-8 max-w-7xl animate-in fade-in duration-500 space-y-10 bg-[#F4F9F5] text-slate-900 rounded-[2.5rem] border border-[#E5EFE7] my-4 shadow-sm">
      
      {/* Banners Carousel / Fallback Hero Search Section */}
      {banners.length > 0 ? (
        <div className="relative rounded-[2.5rem] h-[340px] sm:h-[420px] overflow-hidden shadow-lg border border-slate-100 bg-white group">
          <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentBannerIdx * 100}%)` }}>
            {banners.map((banner) => (
              <div key={banner.id} className="min-w-full h-full relative flex items-center px-8 sm:px-16">
                <div className="absolute inset-0 z-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.bannerImage} alt={banner.bannerHeading} className="w-full h-full object-cover" />
                </div>
                <div className="relative z-20 max-w-md space-y-4 bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border border-slate-100/50 shadow-lg ml-2 sm:ml-4">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-none">{banner.bannerHeading}</h1>
                  <p className="text-slate-700 font-medium text-xs sm:text-sm leading-relaxed">{banner.bannerDescription}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Slider controls */}
          {banners.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentBannerIdx(prev => (prev - 1 + banners.length) % banners.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow hover:scale-105 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setCurrentBannerIdx(prev => (prev + 1) % banners.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow hover:scale-105 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              {/* Indicator dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBannerIdx(i)}
                    className={`h-2 rounded-full transition-all ${currentBannerIdx === i ? "w-6 bg-emerald-600" : "w-2 bg-emerald-250"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Hero Search Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
          Find Your Perfect <span className="text-emerald-600">Hotel Stay</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
          Discover handpicked luxury hotels, cozy suites, and local guest houses with secure escrow bookings.
        </p>

        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mt-6 flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-lg">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by hotel name, description, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 border-0 bg-transparent h-12 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 placeholder-slate-400 text-base"
            />
          </div>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 h-12 font-bold shadow-md shadow-emerald-500/10 shrink-0">
            Search
          </Button>
        </form>
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {hotels.map((hotel) => {
                const images = Array.isArray(hotel.images) ? hotel.images : []
                const coverImage = images[0] || "/images/placeholder-hotel.jpg"
                const startingPrice = hotel.rooms[0]?.price || 0

                return (
                  <Card key={hotel.id} className="rounded-[2rem] overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full group bg-white">
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden shrink-0">
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
                    </div>

                    <CardContent className="p-6 flex flex-col flex-1">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-1.5 text-xs font-semibold text-emerald-600">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{hotel.city || "Sierra Leone"}</span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 leading-tight line-clamp-1">{hotel.name}</h3>

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
          )}
        </div>
      </div>

      {/* Sponsored Ads Section */}
      {ads.length > 0 && (
        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Sponsored Stays</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-500/20">
              {ads.length} {ads.length === 1 ? "ad" : "ads"}
            </span>
            {sponsoredCarouselPaused && (
              <span className="text-xs text-slate-500 font-semibold">(paused)</span>
            )}
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
                          src={ad.creativeUrl}
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
  )
}
