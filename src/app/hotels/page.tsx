"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Star, MapPin, SlidersHorizontal, Eye, RefreshCw } from "lucide-react"
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
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
      {/* Hero Search Section */}
      <div className="mb-10 text-center space-y-4">
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
    </div>
  )
}
