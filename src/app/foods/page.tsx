"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Search, Star, SlidersHorizontal, ArrowRight, Flame, Utensils, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"
import { PublicLayout } from "@/components/site-layout"

type FoodItem = {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  category: string
  isVeg: boolean
  averageRating: number
  totalReviews: number
  restaurantName: string
}

type Banner = {
  id: string
  bannerHeading: string
  bannerDescription: string | null
  bannerImage: string
}

export default function FoodsBrowsePage() {
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [selectedVeg, setSelectedVeg] = useState("ALL")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")

  const [categories, setCategories] = useState<string[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  const [ads, setAds] = useState<any[]>([])
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false)
  const [sponsoredIndex, setSponsoredIndex] = useState(0)
  const sponsoredScrollRef = useRef<HTMLDivElement>(null)

  // Fetch restaurant ads
  useEffect(() => {
    fetch("/api/home/ads?type=restaurant")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAds(data)
      })
      .catch(err => console.error("Error loading restaurant ads:", err))
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

  const fetchFoods = async () => {
    setLoading(true)
    try {
      let url = "/api/customer/foods?"
      if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`
      if (selectedCategory && selectedCategory !== "ALL") url += `category=${encodeURIComponent(selectedCategory)}&`
      if (selectedVeg && selectedVeg !== "ALL") url += `isVeg=${selectedVeg === "VEG"}&`
      if (selectedRating !== null) url += `rating=${selectedRating}&`
      if (minPrice) url += `minPrice=${encodeURIComponent(minPrice)}&`
      if (maxPrice) url += `maxPrice=${encodeURIComponent(maxPrice)}&`

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setFoods(data.data)
        if (data.categories) {
          setCategories(data.categories)
        }
      }
    } catch (error) {
      console.error("Failed to load foods:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load banners targeting restaurants
  useEffect(() => {
    fetch("/api/home/banners")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const foodBanners = data.filter((b: any) => b.targetType === "restaurant")
          setBanners(foodBanners)
        }
      })
      .catch(err => console.error("Error loading restaurant banners:", err))
  }, [])

  useEffect(() => {
    fetchFoods()
  }, [searchQuery, selectedCategory, selectedVeg, selectedRating, minPrice, maxPrice])

  // Auto scroll banners
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setCurrentBannerIdx(prev => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners])

  // Map categories to emojis for cute circle icons
  const getCategoryEmoji = (catName: string) => {
    const name = catName.toLowerCase()
    if (name.includes("starter") || name.includes("appetizer")) return "🥗"
    if (name.includes("main") || name.includes("curry")) return "🍛"
    if (name.includes("dessert") || name.includes("sweet") || name.includes("cake")) return "🍰"
    if (name.includes("beverage") || name.includes("drink") || name.includes("juice")) return "🥤"
    if (name.includes("pizza")) return "🍕"
    if (name.includes("burger")) return "🍔"
    if (name.includes("biryani") || name.includes("rice")) return "🍲"
    if (name.includes("bread") || name.includes("roti") || name.includes("nan")) return "🫓"
    return "🍔"
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-12 animate-in fade-in duration-500 bg-[#FAF8F5] text-amber-950">
      
      {/* Banners Carousel / Fallback Hero Banner */}
      {banners.length > 0 ? (
        <div className="relative rounded-[2.5rem] h-[340px] sm:h-[420px] overflow-hidden shadow-lg border border-[#F5EFE6] bg-[#FAF8F5] group">
          <div className="absolute inset-0 flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentBannerIdx * 100}%)` }}>
            {banners.map((banner) => (
              <div key={banner.id} className="min-w-full h-full relative flex items-center px-8 sm:px-16">
                <div className="absolute inset-0 z-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.bannerImage} alt={banner.bannerHeading} className="w-full h-full object-cover" />
                </div>
                <div className="relative z-20 max-w-md space-y-4 bg-[#FAF8F5]/90 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border border-[#F5EFE6]/50 shadow-lg ml-2 sm:ml-4">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-amber-950 leading-none">{banner.bannerHeading}</h1>
                  <p className="text-amber-800/80 font-medium text-xs sm:text-sm leading-relaxed">{banner.bannerDescription}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Slider controls */}
          {banners.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentBannerIdx(prev => (prev - 1 + banners.length) % banners.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-amber-950 shadow hover:scale-105 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setCurrentBannerIdx(prev => (prev + 1) % banners.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-amber-950 shadow hover:scale-105 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              {/* Indicator dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBannerIdx(i)}
                    className={`h-2 rounded-full transition-all ${currentBannerIdx === i ? "w-6 bg-amber-500" : "w-2 bg-amber-200"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Fallback Organic Hero Banner */
        <div className="rounded-[2.5rem] bg-gradient-to-br from-[#FDFBF7] to-[#F5EFE6] border border-[#F5EFE6] p-8 sm:p-16 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative max-w-xl space-y-6">
            <span className="bg-amber-100 text-amber-800 border border-amber-200 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
              <Flame className="h-4 w-4 text-amber-600" /> Healthy & Fresh Choices
            </span>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-amber-950 leading-none">
              Fresh. Local. Organic.
            </h1>
            <p className="text-amber-900/70 font-semibold text-sm sm:text-lg">
              Freshly cooked organic dishes, gourmet starters, and healthy beverages from certified local kitchens.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => setSelectedCategory("ALL")} className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-full font-bold px-6 h-12 shadow-md shadow-amber-500/10">
                Browse Menu
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Circular Shop by Category Grid */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">Shop by Category</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Fresh organic food items curated for you</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className="flex flex-col items-center gap-2 group focus:outline-none"
          >
            <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center border-2 transition-all ${
              selectedCategory === "ALL" 
                ? "border-amber-500 bg-amber-50 shadow-md scale-105" 
                : "border-[#F5EFE6] bg-white group-hover:border-amber-200 group-hover:bg-[#FAF8F5]"
            }`}>
              <span className="text-2xl sm:text-3xl">🍲</span>
            </div>
            <span className={`text-xs sm:text-sm font-bold tracking-tight ${selectedCategory === "ALL" ? "text-amber-900" : "text-amber-800/80 group-hover:text-amber-950"}`}>
              All Items
            </span>
          </button>
          
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="flex flex-col items-center gap-2 group focus:outline-none"
            >
              <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center border-2 transition-all ${
                selectedCategory === cat 
                  ? "border-amber-500 bg-amber-50 shadow-md scale-105" 
                  : "border-[#F5EFE6] bg-white group-hover:border-amber-200 group-hover:bg-[#FAF8F5]"
              }`}>
                <span className="text-2xl sm:text-3xl">{getCategoryEmoji(cat)}</span>
              </div>
              <span className={`text-xs sm:text-sm font-bold tracking-tight ${selectedCategory === cat ? "text-amber-900" : "text-amber-800/80 group-hover:text-amber-950"}`}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main browse section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start pt-4">
        
        {/* Sidebar Filters */}
        <div className="bg-white border border-[#F5EFE6] rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F5EFE6]">
            <SlidersHorizontal className="h-5 w-5 text-amber-600" />
            <h3 className="font-black text-amber-950">Filters</h3>
          </div>

          {/* Veg/Non-Veg Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-600 uppercase tracking-wider">Food Type</label>
            <div className="flex gap-2">
              {["ALL", "VEG", "NON_VEG"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedVeg(type)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    selectedVeg === type
                      ? "bg-amber-500 border-amber-500 text-amber-950 shadow-md shadow-amber-500/15"
                      : "border-[#F5EFE6] bg-[#FAF8F5] text-amber-850 hover:bg-[#F5EFE6]"
                  }`}
                >
                  {type === "ALL" ? "All" : type === "VEG" ? "Veg" : "Non-Veg"}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-600 uppercase tracking-wider">Price Range</label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="rounded-xl border-[#F5EFE6] text-sm h-10 focus-visible:ring-amber-500 bg-[#FAF8F5]"
              />
              <span className="text-amber-300 font-bold">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="rounded-xl border-[#F5EFE6] text-sm h-10 focus-visible:ring-amber-500 bg-[#FAF8F5]"
              />
            </div>
          </div>

          {/* Rating Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-600 uppercase tracking-wider">Customer Rating</label>
            <div className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((stars) => (
                <button
                  key={stars}
                  onClick={() => setSelectedRating(selectedRating === stars ? null : stars)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    selectedRating === stars
                      ? "bg-amber-50 text-amber-900 font-bold"
                      : "text-amber-800/80 hover:bg-[#FAF8F5]"
                  }`}
                >
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${idx < stars ? "fill-amber-400 text-amber-400" : "text-amber-200"}`}
                      />
                    ))}
                  </div>
                  <span>&amp; Up</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Food Grid */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-amber-700/60" />
            <Input
              placeholder="Search food items, cuisines, dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 rounded-[1.5rem] border-[#F5EFE6] bg-white shadow-sm text-base h-12 focus-visible:ring-amber-500 text-amber-950 placeholder-amber-900/40"
            />
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="rounded-[2rem] overflow-hidden border-none shadow-md bg-amber-50/50 h-80 animate-pulse" />
              ))}
            </div>
          ) : foods.length === 0 ? (
            <div className="text-center py-20 bg-white border border-[#F5EFE6] rounded-3xl shadow-sm">
              <Utensils className="h-16 w-16 text-amber-200 mx-auto mb-4" />
              <h3 className="text-lg font-black text-amber-950">No Food Items Found</h3>
              <p className="text-amber-850/60 text-sm mt-1">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-amber-950 tracking-tight pl-2">This Week's Favorites</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {foods.map((food) => (
                  <Card key={food.id} className="rounded-[2rem] overflow-hidden border border-[#F5EFE6] shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 flex flex-col h-full bg-white group">
                    <div className="relative aspect-[4/3] bg-amber-50/30 overflow-hidden shrink-0">
                      {food.image ? (
                        <img src={food.image} alt={food.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-amber-900/40 bg-amber-50/30 font-bold text-sm">Organic Dish</div>
                      )}
                      <span className={`absolute top-4 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        food.isVeg ? "bg-emerald-50 text-emerald-700 border border-emerald-250" : "bg-rose-50 text-rose-700 border border-rose-250"
                      }`}>
                        {food.isVeg ? "Veg" : "Non-Veg"}
                      </span>
                    </div>

                    <CardContent className="p-5 flex flex-col flex-1 justify-between gap-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{food.category}</span>
                          {food.totalReviews > 0 && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{food.averageRating}</span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-base font-black text-amber-950 leading-tight group-hover:text-amber-600 transition-colors line-clamp-1">{food.name}</h3>
                        <p className="text-amber-905/70 text-xs font-medium line-clamp-2 leading-relaxed">{food.description}</p>
                        <p className="text-[11px] font-bold text-amber-900/40">By {food.restaurantName}</p>
                      </div>

                      <div className="pt-3 border-t border-[#F5EFE6] flex items-center justify-between gap-2">
                        <span className="text-lg font-black text-amber-900">{formatCurrency(food.price)}</span>
                        <Link href={`/foods/${food.id}`}>
                          <Button className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold text-xs uppercase tracking-widest h-10 px-4 flex items-center gap-1 shadow-md shadow-amber-500/10 border border-amber-600/10">
                            Order Now <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sponsored Ads Section */}
      {ads.length > 0 && (
        <section className="bg-white border border-[#F5EFE6] rounded-[2.5rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-amber-950">Sponsored Matches</h2>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-500/20">
              {ads.length} {ads.length === 1 ? "ad" : "ads"}
            </span>
            {sponsoredCarouselPaused && (
              <span className="text-xs text-amber-800/60 font-semibold">(paused)</span>
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-15 p-2 rounded-full bg-white/90 hover:bg-white text-amber-950 shadow-md border border-[#F5EFE6] transition-all hover:scale-105"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSponsoredCarouselPaused(true)
                    setSponsoredIndex(prev => (prev >= ads.length - 1 ? 0 : prev + 1))
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-15 p-2 rounded-full bg-white/90 hover:bg-white text-amber-950 shadow-md border border-[#F5EFE6] transition-all hover:scale-105"
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
                    className="group flex w-[80vw] min-w-[260px] max-w-[290px] shrink-0 snap-start flex-col overflow-hidden rounded-[1.5rem] border border-[#F5EFE6] bg-[#FAF8F5] shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-amber-50/20">
                      {ad.creativeUrl ? (
                        <img
                          src={ad.creativeUrl}
                          alt={ad.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-102"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-amber-900/40 font-bold text-xs bg-amber-50/10">Ad Design</div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-black text-amber-50 uppercase tracking-widest">
                          Sponsored
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4 space-y-1 bg-white">
                      <span className="font-black text-amber-950 line-clamp-1 group-hover:text-amber-600 transition-colors text-sm">
                        {ad.title}
                      </span>
                      {ad.description?.trim() && (
                        <p className="line-clamp-2 text-[11px] text-amber-900/60 leading-normal font-medium">
                          {ad.description}
                        </p>
                      )}
                      <span className="mt-2 inline-flex text-xs font-bold text-amber-700 group-hover:underline">
                        Order Now →
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
    </PublicLayout>
  )
}
