"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Star, SlidersHorizontal, ArrowRight, Flame, Utensils } from "lucide-react"
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
        // Extract unique categories from foods
        const cats = Array.from(new Set(data.data.map((f: FoodItem) => f.category))) as string[]
        setCategories(cats)
      }
    } catch (error) {
      console.error("Failed to load foods:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFoods()
  }, [searchQuery, selectedCategory, selectedVeg, selectedRating, minPrice, maxPrice])

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8 animate-in fade-in duration-500">
        {/* Banner Section */}
        <div className="rounded-[2.5rem] bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 p-8 sm:p-12 text-white relative overflow-hidden shadow-xl shadow-rose-500/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative max-w-xl space-y-4">
            <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
              <Flame className="h-4 w-4 text-amber-300" /> Craving Something Delicious?
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">Order Gourmet Food From Top Outlets</h1>
            <p className="text-rose-100 font-medium text-sm sm:text-base">Explore freshly cooked meals, desserts, starters, and beverages delivered right to your doorstep.</p>
          </div>
        </div>

        {/* Search & Filter Header */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar Filters */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
              <SlidersHorizontal className="h-5 w-5 text-rose-500" />
              <h3 className="font-black text-slate-900">Filters</h3>
            </div>

            {/* Veg/Non-Veg Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Food Type</label>
              <div className="flex gap-2">
                {["ALL", "VEG", "NON_VEG"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedVeg(type)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      selectedVeg === type
                        ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/15"
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {type === "ALL" ? "All" : type === "VEG" ? "Veg" : "Non-Veg"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categories</label>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setSelectedCategory("ALL")}
                  className={`text-left px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${
                    selectedCategory === "ALL"
                      ? "bg-rose-50 text-rose-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-left px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${
                      selectedCategory === cat
                        ? "bg-rose-50 text-rose-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Price Range</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="rounded-xl border-slate-200 text-sm h-10"
                />
                <span className="text-slate-300 font-bold">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="rounded-xl border-slate-200 text-sm h-10"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Rating</label>
              <div className="flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <button
                    key={stars}
                    onClick={() => setSelectedRating(selectedRating === stars ? null : stars)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      selectedRating === stars
                        ? "bg-rose-50 text-rose-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`h-3.5 w-3.5 ${idx < stars ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
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
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search food items, cuisines, dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 rounded-[1.5rem] border-slate-200 shadow-sm text-base h-12"
              />
            </div>

            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Card key={idx} className="rounded-[2rem] overflow-hidden border-none shadow-md bg-slate-50 h-80 animate-pulse" />
                ))}
              </div>
            ) : foods.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <Utensils className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-800">No Food Items Found</h3>
                <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {foods.map((food) => (
                  <Card key={food.id} className="rounded-[2rem] overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full bg-white group">
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden shrink-0">
                      {food.image ? (
                        <img src={food.image} alt={food.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400 bg-slate-50 font-bold text-sm">Delicious Food</div>
                      )}
                      <span className={`absolute top-4 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        food.isVeg ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {food.isVeg ? "Veg" : "Non-Veg"}
                      </span>
                    </div>

                    <CardContent className="p-5 flex flex-col flex-1 justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{food.category}</span>
                          {food.totalReviews > 0 && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{food.averageRating}</span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-900 leading-tight group-hover:text-rose-500 transition-colors line-clamp-1">{food.name}</h3>
                        <p className="text-slate-500 text-xs font-semibold line-clamp-2 leading-relaxed">{food.description}</p>
                        <p className="text-[11px] font-bold text-slate-400">By {food.restaurantName}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                        <span className="text-lg font-black text-rose-600">{formatCurrency(food.price)}</span>
                        <Link href={`/foods/${food.id}`}>
                          <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest h-10 px-4 flex items-center gap-1 shadow-md shadow-rose-500/10">
                            Order Now <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
