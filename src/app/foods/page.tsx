"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Star, MapPin, Utensils, Sparkles, ChevronLeft, ChevronRight, Leaf, Drumstick } from "lucide-react"
import { Input } from "@/ui/input"
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
  }, [searchQuery, selectedCuisine, selectedRating])

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-10 animate-in fade-in duration-500 bg-[#FAF8F5] text-amber-950">

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

        {/* ── Cuisines Filter Scroll ── */}
        <div className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">In the Mood for?</h2>
          
          <div className="relative group/cuisines">
            {/* Scroll Left Button */}
            <button
              onClick={() => {
                const container = document.getElementById("cuisines-scroll-container")
                if (container) container.scrollBy({ left: -200, behavior: "smooth" })
              }}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white border border-amber-200 text-amber-950 shadow-md opacity-0 group-hover/cuisines:opacity-100 transition-opacity hover:bg-amber-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Scroll Container */}
            <div
              id="cuisines-scroll-container"
              className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1 scroll-smooth"
            >
              {/* ALL */}
              <button
                onClick={() => setSelectedCuisine("ALL")}
                className={`flex flex-col items-center gap-2 shrink-0 focus:outline-none transition-all group`}
              >
                <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 transition-all ${selectedCuisine === "ALL" ? "border-amber-500 bg-amber-50 shadow-md scale-105" : "border-[#F5EFE6] bg-white group-hover:border-amber-200"}`}>
                  <span className="text-2xl">🍲</span>
                </div>
                <span className={`text-xs font-bold tracking-tight whitespace-nowrap ${selectedCuisine === "ALL" ? "text-amber-900" : "text-amber-800/70"}`}>All</span>
              </button>

              {cuisines.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCuisine(c)}
                  className="flex flex-col items-center gap-2 shrink-0 focus:outline-none group"
                >
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 transition-all ${selectedCuisine === c ? "border-amber-500 bg-amber-50 shadow-md scale-105" : "border-[#F5EFE6] bg-white group-hover:border-amber-200"}`}>
                    <span className="text-2xl">{getCuisineEmoji(c)}</span>
                  </div>
                  <span className={`text-xs font-bold tracking-tight whitespace-nowrap ${selectedCuisine === c ? "text-amber-900" : "text-amber-800/70"}`}>{c}</span>
                </button>
              ))}
            </div>

            {/* Scroll Right Button */}
            <button
              onClick={() => {
                const container = document.getElementById("cuisines-scroll-container")
                if (container) container.scrollBy({ left: 200, behavior: "smooth" })
              }}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white border border-amber-200 text-amber-950 shadow-md opacity-0 group-hover/cuisines:opacity-100 transition-opacity hover:bg-amber-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Search & Rating Filters ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-3 relative">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-amber-700/60" />
            <Input
              placeholder="Search restaurants, cafes, food joints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 rounded-[1.5rem] border-[#F5EFE6] bg-white shadow-sm text-base h-12 focus-visible:ring-amber-500 text-amber-950 placeholder-amber-900/40"
            />
          </div>
          <div className="flex gap-2">
            {[4, 3].map((rating) => (
              <button
                key={rating}
                onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
                className={`flex-1 py-3 text-xs font-bold rounded-2xl border transition-all flex items-center justify-center gap-1.5 ${selectedRating === rating ? "bg-amber-500 border-amber-500 text-amber-950 shadow-md" : "border-[#F5EFE6] bg-white text-amber-850 hover:bg-[#F5EFE6]"}`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{rating}.0+</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Restaurant List (Zomato style) ── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-amber-950 tracking-tight">
              {loading ? "Loading..." : `${restaurants.length} Restaurant${restaurants.length !== 1 ? "s" : ""} Near You`}
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
              {restaurants.map((resto, idx) => (
                <RestaurantCard key={resto.id} resto={resto} idx={idx} />
              ))}
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
