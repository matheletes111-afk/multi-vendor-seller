"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Utensils, Search, X, Filter } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { formatCurrency } from "@/lib/utils"

type FoodItem = {
  id: string
  name: string
  description: string | null
  price: number
  image: string | null
  category: string
  isVeg: boolean
  isActive: boolean
  restaurantName: string
}

type RestaurantOption = {
  id: string
  name: string
}

export function AdminRestaurantFoodsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const restaurantSellerId = searchParams.get("restaurantSellerId") ?? "ALL"
  const qStr = searchParams.get("q") ?? ""

  const [foods, setFoods] = useState<FoodItem[]>([])
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [q, setQ] = useState(qStr)

  // Fetch restaurant sellers for the filter dropdown
  useEffect(() => {
    fetch("/api/admin/restaurant-sellers?perPage=100")
      .then((r) => r.json())
      .then((json) => {
        if (json?.sellers) {
          setRestaurants(json.sellers.map((s: any) => ({
            id: s.id,
            name: s.businessName || s.name || "Restaurant"
          })))
        }
      })
      .catch(console.error)
  }, [])

  const loadFoods = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (restaurantSellerId && restaurantSellerId !== "ALL") {
      params.set("restaurantSellerId", restaurantSellerId)
    }
    if (qStr) params.set("q", qStr)

    fetch(`/api/admin/restaurant-foods?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setFoods(json.data.foods)
          setTotalCount(json.data.pagination.totalCount ?? 0)
          setTotalPages(json.data.pagination.totalPages ?? 1)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, perPage, restaurantSellerId, qStr])

  useEffect(() => {
    loadFoods()
  }, [loadFoods])

  const handleSearch = () => {
    const p = {
      restaurantSellerId: restaurantSellerId !== "ALL" ? restaurantSellerId : undefined,
      q: q || undefined,
    }
    router.push(buildAdminPageUrl("/admin/restaurant-foods", 1, p))
  }

  const handleClear = () => {
    setQ("")
    router.push("/admin/restaurant-foods")
  }

  if (loading) return <PageLoader message="Loading food items..." />

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Food Menu Directory</h1>
        <p className="text-muted-foreground mt-2">Audit and manage all food items across restaurant sellers</p>
      </div>

      <Card className="rounded-3xl shadow-xl border-none overflow-hidden bg-background">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs uppercase ml-1 opacity-70">Restaurant Seller</Label>
              <Select
                value={restaurantSellerId}
                onValueChange={(val) => {
                  const p = {
                    restaurantSellerId: val !== "ALL" ? val : undefined,
                    q: qStr || undefined,
                  }
                  router.push(buildAdminPageUrl("/admin/restaurant-foods", 1, p))
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="All Restaurants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Restaurants</SelectItem>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs uppercase ml-1 opacity-70">Dish Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search dishes..."
                  className="pl-9 rounded-xl"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleClear} className="flex-1 rounded-xl">
                <X className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button onClick={handleSearch} className="flex-1 rounded-xl font-bold shadow-lg shadow-primary/10">
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-2xl border-none overflow-hidden bg-background">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b-muted/20">
                <TableHead className="py-5 pl-6">Preview</TableHead>
                <TableHead>Dish</TableHead>
                <TableHead>Restaurant Seller</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="pr-6 text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-80 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Utensils className="h-16 w-16 mb-4 opacity-10" />
                      <p className="font-semibold text-xl">No food items found</p>
                      <p className="text-sm opacity-70">Either no restaurant sellers have uploaded foods yet or your filter didn't yield results.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                foods.map((food) => (
                  <TableRow key={food.id} className="hover:bg-muted/10 transition-all border-b-muted/10">
                    <TableCell className="py-4 pl-6">
                      {food.image ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-muted/20 shadow-sm shrink-0">
                          <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-muted-foreground font-bold shrink-0">No Image</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800">{food.name}</span>
                        <span className="text-xs text-slate-400 font-medium max-w-sm line-clamp-1">{food.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-slate-700">
                      {food.restaurantName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg font-semibold px-2 py-0.5 bg-slate-50 border">
                        {food.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg px-2.5 py-0.5 font-bold ${food.isVeg ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        {food.isVeg ? "Veg" : "Non-Veg"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-slate-900 text-sm text-right pr-6">
                      {formatCurrency(food.price)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="px-6 py-6 border-t border-muted/10 bg-muted/5">
            <AdminPagination
              basePath="/admin/restaurant-foods"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={{ restaurantSellerId: restaurantSellerId !== "ALL" ? restaurantSellerId : undefined, q: qStr }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
