"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Star, MapPin, Utensils, Sparkles, ChevronLeft, ChevronRight, Leaf, Drumstick, ChevronDown } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { PublicLayout } from "@/components/site-layout"
import { formatCurrency } from "@/lib/utils"

type PreviewFood = {
  id: string
  name: string
  price: number
  image: string | null
  isVeg: boolean
  category: string
}

type Restaurant = {
  id: string
  businessName: string
  cuisines: string[]
  logo: string | null
  banner: string | null
  mainPhoto: string | null
  street: string
  city: string
  state: string
  averageRating: number
  totalReviews: number
  hasVeg: boolean
  hasNonVeg: boolean
  totalFoods: number
  previewFoods: PreviewFood[]
}

type Banner = {
  id: string
  bannerHeading: string
  bannerDescription: string | null
  bannerImage: string
}

// Fallback food images per category
const FALLBACK_FOOD_IMAGES: Record<string, string> = {
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  biryani: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80",
  sushi: "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&q=80",
  tacos: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80",
  dessert: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&q=80",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
}

function getFallbackFoodImage(category: string, name: string): string {
  const key = [category, name].join(" ").toLowerCase()
  for (const [k, v] of Object.entries(FALLBACK_FOOD_IMAGES)) {
    if (key.includes(k)) return v
  }
  return FALLBACK_FOOD_IMAGES.default
}

function getCuisineEmoji(cName: string): string {
  const name = cName.toLowerCase()
  if (name.includes("italian") || name.includes("pasta") || name.includes("pizza")) return "🍕"
  if (name.includes("indian") || name.includes("biryani") || name.includes("curry")) return "🍛"
  if (name.includes("japanese") || name.includes("sushi")) return "🍣"
  if (name.includes("burger") || name.includes("american") || name.includes("fast")) return "🍔"
  if (name.includes("mexican") || name.includes("tacos")) return "🌮"
  if (name.includes("dessert") || name.includes("sweet") || name.includes("bakery")) return "🍰"
  if (name.includes("salad") || name.includes("veg") || name.includes("healthy")) return "🥗"
  return "🍴"
}

// Horizontal food scroll strip inside each restaurant card
function FoodScrollStrip({ foods, restaurantId }: { foods: PreviewFood[]; restaurantId: string }) {
  const router = useRouter()

  if (foods.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 pt-0.5">
      {foods.map((food) => {
        const img = food.image || getFallbackFoodImage(food.category, food.name)
        return (
          <div
            key={food.id}
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/foods/restaurant/${restaurantId}`)
            }}
            className="relative flex-none w-40 rounded-2xl overflow-hidden border border-[#F5EFE6] bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.03] transition-all duration-200 group/food"
          >
            {/* Food Image */}
            <div className="relative h-32 w-full overflow-hidden bg-amber-50">
              <img
                src={img}
                alt={food.name}
                className="w-full h-full object-cover group-hover/food:scale-110 transition-transform duration-300"
              />
              {/* Veg/Non-veg indicator */}
              <div className={`absolute top-1.5 left-1.5 h-4 w-4 rounded-sm border-2 flex items-center justify-center ${food.isVeg ? "border-emerald-600 bg-white" : "border-red-600 bg-white"}`}>
                <div className={`h-2 w-2 rounded-full ${food.isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
              </div>
              {/* Plus button */}
              <div className="absolute bottom-1.5 right-1.5 h-6 w-6 bg-white border border-amber-300 rounded-md flex items-center justify-center shadow-sm opacity-0 group-hover/food:opacity-100 transition-opacity">
                <span className="text-amber-700 font-black text-sm leading-none">+</span>
              </div>
            </div>

            {/* Food Info */}
            <div className="p-2 space-y-0.5">
              <p className="text-[10px] font-black text-amber-950 leading-tight line-clamp-2">{food.name}</p>
              <p className="text-[10px] font-bold text-amber-700">{formatCurrency(food.price)}</p>
            </div>
          </div>
        )
      })}

      {/* "More dishes" nudge */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          router.push(`/foods/restaurant/${restaurantId}`)
        }}
        className="flex-none w-24 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-100/60 transition-colors"
      >
        <span className="text-2xl">🍽️</span>
        <span className="text-[9px] font-black text-amber-700 text-center leading-tight px-1">View Full Menu</span>
        <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
      </div>
    </div>
  )
}

// Zomato-style Restaurant Card
function RestaurantCard({ resto, idx }: { resto: Restaurant; idx: number }) {
  const router = useRouter()
  const cover = resto.banner || resto.mainPhoto

  return (
    <div
      onClick={() => router.push(`/foods/restaurant/${resto.id}`)}
      className="bg-white rounded-3xl border border-[#F5EFE6] shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer group"
    >
      {/* Header Section with info */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        {/* Top row: logo + name + rating */}
        <div className="flex items-start gap-3">
          {/* Logo or emoji */}
          <div className="h-14 w-14 rounded-2xl overflow-hidden border border-[#F5EFE6] shrink-0 bg-amber-50 flex items-center justify-center shadow-sm">
            {resto.logo ? (
              <img src={resto.logo} alt={resto.businessName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl">{getCuisineEmoji(resto.cuisines[0] || "")}</span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-amber-950 text-base leading-tight group-hover:text-amber-700 transition-colors line-clamp-2">
                {resto.businessName}
              </h3>
              {/* Rating pill */}
              <div className="flex items-center gap-0.5 bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                <Star className="h-2.5 w-2.5 fill-current" />
                <span>{resto.averageRating > 0 ? resto.averageRating : "New"}</span>
              </div>
            </div>

            {/* Cuisines */}
            <p className="text-[11px] font-semibold text-amber-700/70 truncate mt-0.5">
              {resto.cuisines.slice(0, 3).join(" • ")}
            </p>

            {/* Location + dish count row */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1 text-[10px] text-amber-800/50 font-semibold">
                <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="truncate max-w-[120px]">{resto.city}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-amber-800/50 font-semibold">
                <Utensils className="h-3 w-3 text-amber-500 shrink-0" />
                <span>{resto.totalFoods} items</span>
              </div>
              {resto.hasVeg && (
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Veg</span>
              )}
            </div>
          </div>
        </div>

        {/* Cover/banner strip if available */}
        {cover && (
          <div className="rounded-xl overflow-hidden h-48 w-full">
            <img
              src={cover}
              alt={resto.businessName}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
        )}
      </div>

      {/* Horizontal Food Items Strip */}
      {resto.previewFoods.length > 0 && (
        <div className="px-5 pb-5">
          <p className="text-[10px] font-black text-amber-800/40 uppercase tracking-widest mb-2.5">Popular Dishes</p>
          <FoodScrollStrip foods={resto.previewFoods} restaurantId={resto.id} />
        </div>
      )}
    </div>
  )
}

export default function RestaurantsDirectoryPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [cuisines, setCuisines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCuisine, setSelectedCuisine] = useState("ALL")
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [pureVeg, setPureVeg] = useState(false)
  const [nonVeg, setNonVeg] = useState(false)
  const [sortBy, setSortBy] = useState<"rating" | "items" | "default">("default")

  const [visibleCount, setVisibleCount] = useState(20)

  const [banners, setBanners] = useState<Banner[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  const fetchRestaurants = async () => {
    setLoading(true)
    try {
      let url = "/api/customer/restaurants?"
      if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`
      if (selectedCuisine && selectedCuisine !== "ALL") url += `cuisine=${encodeURIComponent(selectedCuisine)}&`

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        let list = data.data as Restaurant[]
        if (selectedRating !== null) {
          list = list.filter(r => r.averageRating >= selectedRating)
        }
        if (pureVeg) {
          list = list.filter(r => r.hasVeg)
        }
        if (nonVeg) {
          list = list.filter(r => r.hasNonVeg)
        }
        if (sortBy === "rating") {
          list = [...list].sort((a, b) => b.averageRating - a.averageRating)
        } else if (sortBy === "items") {
          list = [...list].sort((a, b) => b.totalFoods - a.totalFoods)
        }
        setRestaurants(list)
        if (data.cuisines) setCuisines(data.cuisines)
      }
    } catch (error) {
      console.error("Failed to load restaurants:", error)
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

  // Auto scroll banners
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      setCurrentBannerIdx(prev => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners])

  useEffect(() => {
    fetchRestaurants()
    setVisibleCount(20)
  }, [searchQuery, selectedCuisine, selectedRating, pureVeg, nonVeg, sortBy])

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8 animate-in fade-in duration-500 bg-[#FAF8F5] text-amber-950">

        {/* ── Dynamic Banners Carousel or Fallback Hero ── */}
        {banners.length > 0 ? (
          <div className="relative rounded-[2.5rem] h-[300px] sm:h-[400px] overflow-hidden shadow-lg border border-[#F5EFE6] group">
            <div
              className="absolute inset-0 flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentBannerIdx * 100}%)` }}
            >
              {banners.map((banner) => (
                <div key={banner.id} className="min-w-full h-full relative flex items-center px-8 sm:px-16">
                  <div className="absolute inset-0 z-0">
                    <img src={banner.bannerImage} alt={banner.bannerHeading} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                  <div className="relative z-20 max-w-md space-y-4 bg-[#FAF8F5]/90 backdrop-blur-md p-6 sm:p-8 rounded-[2rem] border border-[#F5EFE6]/50 shadow-lg">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-amber-950 leading-none">{banner.bannerHeading}</h1>
                    <p className="text-amber-800/80 font-medium text-xs sm:text-sm leading-relaxed">{banner.bannerDescription}</p>
                  </div>
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <button onClick={() => setCurrentBannerIdx(prev => (prev - 1 + banners.length) % banners.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-amber-950 shadow hover:scale-105 transition-all">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setCurrentBannerIdx(prev => (prev + 1) % banners.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/80 hover:bg-white text-amber-950 shadow hover:scale-105 transition-all">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setCurrentBannerIdx(i)} className={`h-2 rounded-full transition-all ${currentBannerIdx === i ? "w-6 bg-amber-500" : "w-2 bg-white/60"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#FDFBF7] to-[#F5EFE6] border border-[#F5EFE6] p-8 sm:p-16 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="relative max-w-xl space-y-6">
              <span className="bg-amber-100 text-amber-800 border border-amber-200 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
                <Sparkles className="h-4 w-4 text-amber-600" /> Premium Kitchen Partners
              </span>
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-amber-950 leading-none">
                Delicious Food,<br />Delivered Fast.
              </h1>
              <p className="text-amber-900/70 font-semibold text-sm sm:text-lg">
                Explore local restaurants, browse their menus and add multiple dishes to your cart.
              </p>
            </div>
          </div>
        )}

        {/* ── Search and Filter Controls ── */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-amber-700/60" />
            <Input
              placeholder="Search restaurants, cuisines, cafes, food joints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 rounded-[1.5rem] border-[#F5EFE6] bg-white shadow-sm text-base h-12 focus-visible:ring-amber-500 text-amber-950 placeholder-amber-900/40"
            />
          </div>

          {/* Toggle Filter Pills Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Custom Cuisines Dropdown Select */}
            <div className="relative shrink-0">
              <select
                value={selectedCuisine}
                onChange={(e) => setSelectedCuisine(e.target.value)}
                className="px-4 py-2 pr-8 rounded-xl text-xs font-bold transition-all border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer h-9"
              >
                <option value="ALL">Cuisine: All Cuisines 🍲</option>
                {cuisines.map((c) => (
                  <option key={c} value={c}>
                    {c} {getCuisineEmoji(c)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Pure Veg Pill */}
            <button
              onClick={() => setPureVeg(!pureVeg)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                pureVeg
                  ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Leaf className={`h-3.5 w-3.5 ${pureVeg ? "fill-emerald-600 text-emerald-600" : "text-slate-400"}`} />
              <span>Pure Veg</span>
            </button>

            {/* Non-Veg Pill */}
            <button
              onClick={() => setNonVeg(!nonVeg)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                nonVeg
                  ? "bg-rose-50 border-rose-500 text-rose-800 shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Drumstick className={`h-3.5 w-3.5 ${nonVeg ? "fill-rose-600 text-rose-600" : "text-slate-400"}`} />
              <span>Non-Veg</span>
            </button>

            {/* Rating Pill */}
            <button
              onClick={() => setSelectedRating(selectedRating === 4 ? null : 4)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedRating === 4
                  ? "bg-amber-500 border-amber-500 text-amber-950 shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${selectedRating === 4 ? "fill-amber-950 text-amber-950" : "text-slate-400"}`} />
              <span>Ratings 4.0+</span>
            </button>

            <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block" />

            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Sort By</span>

            <button
              onClick={() => setSortBy(sortBy === "rating" ? "default" : "rating")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                sortBy === "rating"
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Rating (High to Low)
            </button>

            <button
              onClick={() => setSortBy(sortBy === "items" ? "default" : "items")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                sortBy === "items"
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Menu Size
            </button>
          </div>
        </div>

        {/* ── Restaurant List (Zomato style) ── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-amber-950 tracking-tight">
              Restaurants Near You
            </h3>
          </div>

          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-3xl border border-[#F5EFE6] shadow-sm p-5 space-y-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-amber-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-amber-100 rounded w-2/3" />
                      <div className="h-3 bg-amber-50 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-24 bg-amber-50 rounded-xl w-full" />
                  <div className="flex gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="w-32 h-32 bg-amber-50 rounded-2xl shrink-0" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-20 bg-white border border-[#F5EFE6] rounded-3xl shadow-sm">
              <Utensils className="h-16 w-16 text-amber-200 mx-auto mb-4" />
              <h3 className="text-lg font-black text-amber-950">No Restaurants Found</h3>
              <p className="text-amber-850/60 text-sm mt-1">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {restaurants.slice(0, visibleCount).map((resto, idx) => (
                <RestaurantCard key={resto.id} resto={resto} idx={idx} />
              ))}
              
              {/* Pagination Loader */}
              {visibleCount < restaurants.length && (
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={() => setVisibleCount(prev => prev + 20)}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-full font-bold px-8 py-2.5 border border-amber-600/10 shadow-md transition-all h-11"
                  >
                    Load More Restaurants
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </PublicLayout>
  )
}
