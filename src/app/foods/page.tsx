"use client"

import { useState, useEffect, useRef, Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Search,
  Star,
  MapPin,
  Utensils,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Drumstick,
  ChevronDown,
  RefreshCw
} from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { PublicLayout } from "@/components/site-layout"
import { FoodDetailModal } from "@/components/foods/food-detail-modal"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency } from "@/lib/utils"
import { WishlistButton } from "@/components/product/WishlistButton"

function getYoutubeThumbnailUrl(url?: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      let videoId: string | null = null
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1)
      } else {
        videoId = parsed.searchParams.get("v")
      }
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      }
    }
  } catch {
    return null
  }
  return null
}

type PreviewFood = {
  id: string
  name: string
  price: number
  image: string | null
  isVeg: boolean
  category: string
  restaurantName?: string
  restaurantId?: string
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
  mobileBanner?: string | null
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

const FALLBACK_VEG_FOODS: PreviewFood[] = [
  { id: "fb_v1", name: "Paneer Butter Masala", price: 280, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80", isVeg: true, category: "curry" },
  { id: "fb_v2", name: "Veg Supreme Pizza", price: 320, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80", isVeg: true, category: "pizza" },
  { id: "fb_v3", name: "Hyderabadi Veg Biryani", price: 250, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80", isVeg: true, category: "biryani" },
  { id: "fb_v4", name: "Garden Fresh Salad", price: 180, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80", isVeg: true, category: "salad" }
]

const FALLBACK_NONVEG_FOODS: PreviewFood[] = [
  { id: "fb_nv1", name: "Chicken Dum Biryani", price: 350, image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80", isVeg: false, category: "biryani" },
  { id: "fb_nv2", name: "Butter Chicken Curry", price: 380, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=80", isVeg: false, category: "curry" },
  { id: "fb_nv3", name: "Classic Beef Burger", price: 290, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80", isVeg: false, category: "burger" },
  { id: "fb_nv4", name: "Pepperoni Meat Pizza", price: 420, image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&q=80", isVeg: false, category: "pizza" }
]

const FALLBACK_TOP_RESTAURANTS: Partial<Restaurant>[] = [
  { id: "fb_r1", businessName: "Royal Spice Palace", averageRating: 4.8, city: "Downtown", logo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&q=80", cuisines: ["Indian", "Mughlai"] },
  { id: "fb_r2", businessName: "Bella Italia Bistro", averageRating: 4.7, city: "Westside", logo: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80", cuisines: ["Italian", "Pasta"] },
  { id: "fb_r3", businessName: "Dragon Wok & Grill", averageRating: 4.6, city: "Chinatown", logo: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=300&q=80", cuisines: ["Asian", "Chinese"] },
  { id: "fb_r4", businessName: "The Burger Bar", averageRating: 4.5, city: "Central", logo: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&q=80", cuisines: ["American", "Burgers"] }
]

const POPULAR_CUISINES_LIST = [
  { name: "Biryani & Rice", query: "Biryani", icon: "🍛", label: "Top Seller", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
  { name: "Pizza & Pastas", query: "Pizza", icon: "🍕", label: "Cheesy", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80" },
  { name: "Burgers & Fries", query: "Burger", icon: "🍔", label: "Fast Food", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" },
  { name: "Cakes & Sweets", query: "Dessert", icon: "🍰", label: "Desserts", image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&q=80" },
  { name: "Asian Noodles", query: "Chinese", icon: "🥢", label: "Asian Wok", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80" },
  { name: "Mexican Tacos", query: "Mexican", icon: "🌮", label: "Spicy", image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80" },
  { name: "Fresh Salads", query: "Salad", icon: "🥗", label: "Healthy", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80" },
  { name: "Seafood Grill", query: "Seafood", icon: "🦞", label: "Ocean Fresh", image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=80" },
]

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

// Horizontal food scroll strip inside each restaurant card with Left/Right navigation buttons
function FoodScrollStrip({
  foods,
  restaurantId,
  onFoodClick
}: {
  foods: PreviewFood[];
  restaurantId: string;
  onFoodClick: (foodItemId: string) => void
}) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  if (foods.length === 0) return null

  const handleScroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return
    const distance = 200
    scrollRef.current.scrollBy({
      left: dir === "left" ? -distance : distance,
      behavior: "smooth"
    })
  }

  return (
    <div className="space-y-1.5">
      {/* Header with section title + Left/Right move buttons */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Popular Dishes</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleScroll("left")
            }}
            className="h-6 w-6 rounded-full bg-slate-100 hover:bg-emerald-600 text-slate-600 hover:text-white flex items-center justify-center transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Previous Dishes"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleScroll("right")
            }}
            className="h-6 w-6 rounded-full bg-slate-100 hover:bg-emerald-600 text-slate-600 hover:text-white flex items-center justify-center transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Next Dishes"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable food items container */}
      <div className="relative group/strip">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-1 pt-0.5"
        >
          {foods.map((food) => {
            const img = food.image || getFallbackFoodImage(food.category, food.name)
            return (
              <div
                key={food.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onFoodClick(food.id)
                }}
                className="relative flex-none w-36 sm:w-40 rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-2xs cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group/food"
              >
                {/* Food Image */}
                <div className="relative h-24 sm:h-28 w-full overflow-hidden bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={food.name}
                    className="w-full h-full object-cover group-hover/food:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.onerror = null
                      target.src = FALLBACK_FOOD_IMAGES.default
                    }}
                  />
                  {/* Veg/Non-veg indicator */}
                  <div className={`absolute top-1.5 left-1.5 h-4 w-4 rounded-sm border-2 flex items-center justify-center ${food.isVeg ? "border-emerald-600 bg-white" : "border-red-600 bg-white"}`}>
                    <div className={`h-2 w-2 rounded-full ${food.isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
                  </div>
                  <div className="absolute top-1 right-1 z-10 scale-75 origin-top-right">
                    <WishlistButton
                      foodItemId={food.id}
                      name={food.name}
                      image={img}
                      price={food.price}
                      isVeg={food.isVeg}
                      category={food.category}
                    />
                  </div>
                </div>

                {/* Food Info */}
                <div className="p-2 space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-1 group-hover/food:text-emerald-600 transition-colors">
                    {food.name}
                  </p>
                  <p className="text-[11px] font-black text-emerald-600">{formatCurrency(food.price)}</p>
                </div>
              </div>
            )
          })}

          {/* "View Full Menu" card */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/foods/restaurant/${restaurantId}`)
            }}
            className="flex-none w-28 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-100/80 transition-all group/menu shrink-0"
          >
            <span className="text-2xl group-hover/menu:scale-110 transition-transform">🍽️</span>
            <span className="text-[10px] font-extrabold text-emerald-800 text-center leading-tight px-1">
              View Full Menu →
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Zomato-style Restaurant Card
function RestaurantCard({
  resto,
  onFoodClick
}: {
  resto: Restaurant;
  onFoodClick: (foodItemId: string) => void
}) {
  const router = useRouter()
  const cover = resto.banner || resto.mainPhoto

  return (
    <div
      onClick={() => router.push(`/foods/restaurant/${resto.id}`)}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group flex flex-col justify-between"
    >
      {/* Header Section */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-start gap-3">
          {/* Logo or emoji */}
          <div className="h-14 w-14 rounded-2xl overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center shadow-xs">
            {resto.logo ? (
              <img
                src={resto.logo}
                alt={resto.businessName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.onerror = null
                  target.src = FALLBACK_FOOD_IMAGES.default
                }}
              />
            ) : (
              <span className="text-2xl">{getCuisineEmoji(resto.cuisines[0] || "")}</span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-emerald-600 transition-colors line-clamp-2">
                {resto.businessName}
              </h3>
              {/* Rating pill + User Count */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-0.5 bg-emerald-600 text-white text-[10px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
                  <span>{(resto.averageRating || 0).toFixed(1)}</span>
                  <Star className="h-2.5 w-2.5 fill-current" />
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  ({(resto.totalReviews || 0).toLocaleString()})
                </span>
              </div>
            </div>

            {/* Cuisines */}
            <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
              {resto.cuisines.slice(0, 3).join(" • ") || "Delicious Food"}
            </p>

            {/* Location + dish count row */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="truncate max-w-[120px]">{resto.city || "Local"}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                <Utensils className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>{resto.totalFoods} items</span>
              </div>
              {resto.hasVeg && (
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Pure Veg</span>
              )}
            </div>
          </div>
        </div>

        {/* Cover/banner strip if available */}
        {cover && (
          <div className="rounded-xl overflow-hidden h-44 w-full bg-slate-100">
            <img
              src={cover}
              alt={resto.businessName}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.onerror = null
                target.src = FALLBACK_FOOD_IMAGES.default
              }}
            />
          </div>
        )}
      </div>

      {/* Horizontal Food Items Strip */}
      {resto.previewFoods.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Popular Dishes</p>
          <FoodScrollStrip foods={resto.previewFoods} restaurantId={resto.id} onFoodClick={onFoodClick} />
        </div>
      )}
    </div>
  )
}

function RestaurantsDirectoryPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQ = searchParams?.get("q") || ""
  const initialCuisine = searchParams?.get("cuisine") || ""

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [cuisines, setCuisines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [selectedCuisine, setSelectedCuisine] = useState(initialCuisine)

  useEffect(() => {
    setSearchQuery(initialQ)
    setSelectedCuisine(initialCuisine)
  }, [initialQ, initialCuisine])

  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [pureVeg, setPureVeg] = useState(false)
  const [nonVeg, setNonVeg] = useState(false)
  const [sortBy, setSortBy] = useState<"rating" | "items" | "default">("default")

  // Food Detail Modal State
  const [selectedFoodItemId, setSelectedFoodItemId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // 50 item pagination limit
  const [visibleCount, setVisibleCount] = useState<number>(50)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)

  // Banners & Sponsored Ads
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)
  const [ads, setAds] = useState<any[]>([])
  const [sponsoredCarouselPaused, setSponsoredCarouselPaused] = useState(false)
  const [sponsoredIndex, setSponsoredIndex] = useState(0)
  const sponsoredScrollRef = useRef<HTMLDivElement>(null)

  const [initialLoading, setInitialLoading] = useState(true)

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
      setInitialLoading(false)
    }
  }

  const [bannersLoading, setBannersLoading] = useState(true)

  // Load banners targeting restaurants
  useEffect(() => {
    setBannersLoading(true)
    fetch("/api/home/banners?targetType=restaurant")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const foodBanners = data.filter((b: any) => b.targetType === "restaurant")
          setBanners(foodBanners)
        }
      })
      .catch(err => console.error("Error loading restaurant banners:", err))
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

  useEffect(() => {
    fetchRestaurants()
    setVisibleCount(50)
  }, [searchQuery, selectedCuisine, selectedRating, pureVeg, nonVeg, sortBy])

  // Extract all preview foods for randomVeg and randomNonVeg 4-card sections + fallbacks
  const { displayVegFoods, displayNonVegFoods, displayTopRestaurants } = useMemo(() => {
    const vegList: PreviewFood[] = []
    const nonVegList: PreviewFood[] = []

    restaurants.forEach(r => {
      r.previewFoods?.forEach(f => {
        const foodWithResto = { ...f, restaurantName: r.businessName, restaurantId: r.id }
        if (f.isVeg) {
          vegList.push(foodWithResto)
        } else {
          nonVegList.push(foodWithResto)
        }
      })
    })

    // Fallback padding to always ensure 4 items in grid
    const finalVeg = [...vegList]
    while (finalVeg.length < 4) {
      finalVeg.push(FALLBACK_VEG_FOODS[finalVeg.length % FALLBACK_VEG_FOODS.length])
    }

    const finalNonVeg = [...nonVegList]
    while (finalNonVeg.length < 4) {
      finalNonVeg.push(FALLBACK_NONVEG_FOODS[finalNonVeg.length % FALLBACK_NONVEG_FOODS.length])
    }

    const sortedTop = [...restaurants].sort((a, b) => b.averageRating - a.averageRating)
    const finalTop: any[] = [...sortedTop]
    while (finalTop.length < 4) {
      finalTop.push(FALLBACK_TOP_RESTAURANTS[finalTop.length % FALLBACK_TOP_RESTAURANTS.length])
    }

    return {
      displayVegFoods: finalVeg.slice(0, 4),
      displayNonVegFoods: finalNonVeg.slice(0, 4),
      displayTopRestaurants: finalTop.slice(0, 4)
    }
  }, [restaurants])

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#FAF8F5] text-slate-900 pb-16">
        {initialLoading ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <PageLoader message="Loading…" />
          </div>
        ) : (
          <>
            {/* ── 1. HERO BANNERS CAROUSEL SECTION (Matches Hotel Page UI/UX) ── */}
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
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.onerror = null
                            target.src = FALLBACK_FOOD_IMAGES.default
                          }}
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
              /* Fallback Hero Banner */
              <div className="relative w-full h-full flex flex-col justify-center px-6 sm:px-12 bg-gradient-to-r from-slate-950 via-emerald-950 to-teal-950 text-white">
                <div className="max-w-2xl space-y-3 z-10">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-400/30">
                    🍔 Discover Top Restaurants & Stays
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                    Order Gourmet Food & Dining Specials
                  </h1>
                  <p className="text-slate-300 text-sm sm:text-base max-w-xl font-medium">
                    Explore curated restaurants, order signature dishes, and get instant doorstep delivery.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── 2. FEATURED 4-COLLECTION CARDS (Overlapping Lower 30% of Hero Banner — Identical to Hotel & Marketplace UI) ── */}
        <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 mt-4 sm:-mt-28 md:-mt-32 lg:-mt-36 xl:-mt-40 relative z-20 pb-6 sm:pb-8 flex items-center justify-center">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 w-full">

            {/* CARD 1: Pure Veg Delights (4 Items 2x2 Grid + Fallback) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-emerald-100 text-sm">
                      🌿
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Pure Veg Delights
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {displayVegFoods.map((food, sIdx) => {
                      const imgUrl = food.image || getFallbackFoodImage(food.category, food.name)
                      return (
                        <div
                          key={food.id || `veg_${sIdx}`}
                          onClick={() => {
                            if (food.id && !food.id.startsWith("fb_")) {
                              setSelectedFoodItemId(food.id)
                              setModalOpen(true)
                            }
                          }}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-emerald-50/50 hover:border-emerald-200 cursor-pointer"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={food.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.src = FALLBACK_FOOD_IMAGES.default
                              }}
                            />
                            <div className="absolute top-1 left-1 h-3.5 w-3.5 rounded-xs border-2 border-emerald-600 bg-white flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            </div>
                            {food.id && !food.id.startsWith("fb_") && (
                              <div className="absolute top-1 right-1 z-10 scale-75 origin-top-right">
                                <WishlistButton
                                  foodItemId={food.id}
                                  name={food.name}
                                  image={imgUrl}
                                  price={food.price}
                                  isVeg={food.isVeg}
                                  category={food.category}
                                  restaurantName={food.restaurantName}
                                />
                              </div>
                            )}
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600">
                            {food.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="font-bold text-emerald-600">{formatCurrency(food.price)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPureVeg(true)}
                  className="mt-4 block text-left text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  See all Pure Veg →
                </button>
              </CardContent>
            </Card>

            {/* CARD 2: Non-Veg Specials (4 Items 2x2 Grid + Fallback) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-rose-100 text-sm">
                      🍗
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Non-Veg Specials
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {displayNonVegFoods.map((food, sIdx) => {
                      const imgUrl = food.image || getFallbackFoodImage(food.category, food.name)
                      return (
                        <div
                          key={food.id || `nonveg_${sIdx}`}
                          onClick={() => {
                            if (food.id && !food.id.startsWith("fb_")) {
                              setSelectedFoodItemId(food.id)
                              setModalOpen(true)
                            }
                          }}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-rose-50/50 hover:border-rose-200 cursor-pointer"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={food.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.src = FALLBACK_FOOD_IMAGES.default
                              }}
                            />
                            <div className="absolute top-1 left-1 h-3.5 w-3.5 rounded-xs border-2 border-red-600 bg-white flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            </div>
                            {food.id && !food.id.startsWith("fb_") && (
                              <div className="absolute top-1 right-1 z-10 scale-75 origin-top-right">
                                <WishlistButton
                                  foodItemId={food.id}
                                  name={food.name}
                                  image={imgUrl}
                                  price={food.price}
                                  isVeg={food.isVeg}
                                  category={food.category}
                                  restaurantName={food.restaurantName}
                                />
                              </div>
                            )}
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-rose-600">
                            {food.name}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="font-bold text-rose-600">{formatCurrency(food.price)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setNonVeg(true)}
                  className="mt-4 block text-left text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  See all Non-Veg →
                </button>
              </CardContent>
            </Card>

            {/* CARD 3: Top Rated Dining Spots (4 Spots 2x2 Grid + Fallback) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-amber-100 text-sm">
                      👑
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Top Rated Outlets
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {displayTopRestaurants.map((resto, sIdx) => {
                      const rawImg = resto.banner || resto.mainPhoto || resto.logo
                      const imgUrl = (rawImg && typeof rawImg === "string" && !rawImg.toLowerCase().includes("adam castillo"))
                        ? rawImg
                        : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&q=80"
                      return (
                        <div
                          key={resto.id || `tr_${sIdx}`}
                          onClick={() => {
                            if (resto.id && !resto.id.startsWith("fb_")) {
                              router.push(`/foods/restaurant/${resto.id}`)
                            }
                          }}
                          className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-amber-50/50 hover:border-amber-200 cursor-pointer"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={resto.businessName || "Restaurant"}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&q=80"
                              }}
                            />
                          </div>
                          <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-amber-600">
                            {resto.businessName}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                            <span className="text-amber-600 font-extrabold">⭐ {resto.averageRating || "4.5"}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRating(4)}
                  className="mt-4 block text-left text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  See Top Rated →
                </button>
              </CardContent>
            </Card>

            {/* CARD 4: Popular Cuisines (Visual Card Grid with Image Backgrounds & Badges) */}
            <Card className="overflow-hidden border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md rounded-none flex flex-col justify-between">
              <CardContent className="p-0 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-blue-100 text-sm">
                      🔥
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug line-clamp-1">
                      Popular Cuisines
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    {POPULAR_CUISINES_LIST.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedCuisine(item.query)}
                        className="group flex flex-col bg-slate-50/60 rounded-none p-1.5 border border-slate-100 transition-all hover:bg-blue-50/50 hover:border-blue-200 cursor-pointer"
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-none bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.onerror = null
                              target.src = FALLBACK_FOOD_IMAGES.default
                            }}
                          />
                          <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded-none font-bold">
                            {item.icon}
                          </div>
                        </div>
                        <span className="mt-1.5 text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600">
                          {item.name}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span className="font-extrabold text-blue-600 uppercase">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCuisine("ALL")}
                  className="mt-4 block text-left text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  Explore All Cuisines →
                </button>
              </CardContent>
            </Card>

          </div>
        </section>

        <div className="w-full max-w-[1440px] mx-auto px-2 sm:px-4 space-y-10">
          
          {/* ── 3. SEARCH & FILTER CONTROLS (Clean White Hotel-Style UI) ── */}
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200">
                <Search className="h-3.5 w-3.5" /> Direct Restaurant & Cuisine Finder
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Find Your Perfect <span className="text-emerald-600">Restaurant & Dining</span>
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-2xl">
                Search by restaurant name, cuisine type, specialty dishes, or city location.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search by restaurant name, food item, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-2xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm focus-visible:ring-emerald-500 font-medium shadow-2xs"
                />
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              {/* Cuisines Dropdown Select */}
              <div className="relative shrink-0">
                <select
                  value={selectedCuisine}
                  onChange={(e) => setSelectedCuisine(e.target.value)}
                  className="px-4 py-2 pr-8 rounded-xl text-xs font-bold transition-all border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer h-9"
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
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
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
                    ? "bg-rose-50 border-rose-500 text-rose-700 shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Drumstick className={`h-3.5 w-3.5 ${nonVeg ? "fill-rose-600 text-rose-600" : "text-slate-400"}`} />
                <span>Non-Veg</span>
              </button>

              {/* Rating 4.0+ Pill */}
              <button
                onClick={() => setSelectedRating(selectedRating === 4 ? null : 4)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedRating === 4
                    ? "bg-amber-50 border-amber-500 text-amber-700 shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${selectedRating === 4 ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
                <span>Ratings 4.0+</span>
              </button>

              <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block" />

              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Sort By</span>

              <button
                onClick={() => setSortBy(sortBy === "rating" ? "default" : "rating")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  sortBy === "rating"
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Rating (High to Low)
              </button>

              <button
                onClick={() => setSortBy(sortBy === "items" ? "default" : "items")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  sortBy === "items"
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Menu Size
              </button>
            </div>
          </div>

          {/* ── 4. SPONSORED SPOTLIGHT AD SECTION (Matching Marketplace & Hotel Spotlight UI) ── */}
          {(() => {
            const activeAd = ads.length > 0 ? (ads[sponsoredIndex] || ads[0]) : {
              id: "fallback_ad_1",
              title: "Promoting Gourmet Dining & Special Deals",
              description: "Discover top-rated dining partners, exclusive combo discounts, and instant doorstep delivery from verified local sellers.",
              creativeUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
            }
            const adPageHref = activeAd.id.startsWith("fallback_") ? "/foods" : `/api/ads/click?adId=${activeAd.id}&redirect_to_ad=true`
            const thumbnail = getYoutubeThumbnailUrl(activeAd.creativeUrl) || activeAd.creativeUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"

            return (
              <div
                className="relative overflow-hidden rounded-[2rem] border border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-amber-100/40 to-orange-50/30 p-5 sm:p-8 shadow-sm my-6"
                onMouseEnter={() => setSponsoredCarouselPaused(true)}
                onMouseLeave={() => setSponsoredCarouselPaused(false)}
              >
                <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
                <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-orange-400/15 blur-3xl pointer-events-none" />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center relative z-10">
                  {/* Left: Banner Creative */}
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900/10 shadow-md md:col-span-6 lg:col-span-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail}
                      alt={activeAd.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.onerror = null
                        target.src = FALLBACK_FOOD_IMAGES.default
                      }}
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                      <span className="rounded-full bg-orange-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-md">
                        ★ SPONSORED SPOTLIGHT
                      </span>
                    </div>
                  </div>

                  {/* Right: Info & Action */}
                  <div className="flex flex-col justify-between md:col-span-6 lg:col-span-7 space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 border border-amber-300 px-3 py-0.5 text-xs font-extrabold text-amber-900">
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Featured Merchant Offer
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/90 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
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

                      {/* Feature Badges Row (Express Delivery & Verified Seller) */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-2 bg-white/90 border border-amber-200/80 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-slate-800 shadow-2xs">
                          <span className="text-amber-600 text-base">⚡</span>
                          <div>
                            <span className="block text-[11px] font-extrabold text-slate-900 leading-none">Express Delivery</span>
                            <span className="text-[9px] font-semibold text-slate-500">Available Today</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white/90 border border-blue-200/80 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-slate-800 shadow-2xs">
                          <span className="text-blue-600 text-base">🛡️</span>
                          <div>
                            <span className="block text-[11px] font-extrabold text-slate-900 leading-none">Verified Seller</span>
                            <span className="text-[9px] font-semibold text-slate-500">100% Authentic</span>
                          </div>
                        </div>
                      </div>

                      {/* Star Rating Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-500 text-sm">⭐⭐⭐⭐⭐</span>
                        <span className="text-xs font-extrabold text-slate-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                          4.9 Rating
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Link href={adPageHref}>
                        <Button className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md transition-all text-xs uppercase tracking-wider flex items-center gap-2">
                          <span>Order Featured Dining</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      {ads.length > 1 && (
                        <span className="text-xs font-bold text-slate-500">
                          Ad {sponsoredIndex + 1} of {ads.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── 5. RESTAURANTS LISTING DIRECTORY ── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Restaurants & Dining Partners
                </h3>
                <p className="text-slate-500 text-xs font-medium mt-0.5">
                  Showing top dining outlets near you
                </p>
              </div>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                {restaurants.length} Verified Outlets
              </span>
            </div>

            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 animate-pulse shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-2/3" />
                        <div className="h-3 bg-slate-50 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-32 bg-slate-100 rounded-xl w-full" />
                  </div>
                ))}
              </div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl p-8 shadow-xs">
                <Utensils className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-900">No Restaurants Found</h3>
                <p className="text-slate-500 text-sm mt-1 font-medium">Try adjusting your filters or search terms.</p>
                <Button onClick={() => { setSearchQuery(""); setSelectedCuisine(""); setSelectedRating(null); setPureVeg(false); setNonVeg(false); }} className="mt-4 bg-slate-900 text-white rounded-xl">Reset Search</Button>
              </div>
            ) : (
              <>
                {/* Responsive 3-Column Restaurant Cards Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {restaurants.slice(0, visibleCount).map((resto) => (
                    <RestaurantCard
                      key={resto.id}
                      resto={resto}
                      onFoodClick={(foodId) => {
                        setSelectedFoodItemId(foodId)
                        setModalOpen(true)
                      }}
                    />
                  ))}
                </div>

                {/* SEE MORE RESTAURANTS (50 items limit) */}
                <div className="mt-10 flex flex-col items-center justify-center gap-3 pt-6 border-t border-slate-200/80">
                  {visibleCount < restaurants.length ? (
                    <>
                      <p className="text-xs font-bold text-slate-500">
                        Showing {Math.min(visibleCount, restaurants.length)} of {restaurants.length} restaurants
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
                            <span>Loading More Restaurants...</span>
                          </>
                        ) : (
                          <>
                            <span>See More Restaurants (50 more)</span>
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-extrabold text-emerald-700 border border-emerald-200/80">
                      ✨ Showing all {restaurants.length} restaurants
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>

        {/* Food Item Detail & Review Popup Modal */}
        <FoodDetailModal
          foodItemId={selectedFoodItemId}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
          </>
        )}

      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </PublicLayout>
  )
}

export default function RestaurantsDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <PageLoader message="Loading…" />
        </div>
      }
    >
      <RestaurantsDirectoryPageContent />
    </Suspense>
  )
}
