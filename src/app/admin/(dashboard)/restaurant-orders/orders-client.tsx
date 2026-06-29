"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { ShoppingBag, User, Store, Search, Filter, X, ChevronRight, Utensils } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type FoodOrderItem = {
  id: string
  foodName: string
  quantity: number
  price: number
  subtotal: number
  imageUrl: string | null
}

type FoodOrder = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  customerName: string
  customerEmail: string
  restaurantName: string
  itemsCount: number
  items: FoodOrderItem[]
}

type RestaurantOption = {
  id: string
  name: string
}

export function AdminRestaurantOrdersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10

  // Accordion state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter states
  const [restaurantSearch, setRestaurantSearch] = useState(searchParams.get("restaurantSellerId") || "ALL")
  const [statusSearch, setStatusSearch] = useState(searchParams.get("status") || "ALL")
  const [keywordSearch, setKeywordSearch] = useState(searchParams.get("q") || "")

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [data, setData] = useState<{
    orders: FoodOrder[]
    pagination: {
      totalCount: number
      totalPages: number
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch restaurant sellers
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

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("perPage", perPage.toString())
    return `/api/admin/restaurant-orders?${params.toString()}`
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(fetchUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setData(json.data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchUrl])

  const handleSearch = () => {
    const params = new URLSearchParams()
    
    if (restaurantSearch && restaurantSearch !== "ALL") {
      params.set("restaurantSellerId", restaurantSearch)
    }
    
    if (statusSearch && statusSearch !== "ALL") {
      params.set("status", statusSearch)
    }
    
    if (keywordSearch) {
      params.set("q", keywordSearch)
    }
    
    params.set("page", "1")
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    setRestaurantSearch("ALL")
    setStatusSearch("ALL")
    setKeywordSearch("")
    router.push(pathname)
  }

  if (loading && !data) return <PageLoader variant="listing" message="Loading restaurant orders…" />

  const orders = data?.orders ?? []
  const totalCount = data?.pagination.totalCount ?? 0
  const totalPages = data?.pagination.totalPages ?? 1

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Restaurant Orders</h1>
        <p className="text-muted-foreground mt-2">Audit and track customer food orders across restaurants</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="px-4 py-1.5 text-xs font-semibold rounded-full shadow-sm bg-background border-emerald-200 text-emerald-700 uppercase tracking-wider">
          {totalCount} Food Orders
        </Badge>
      </div>

      <Card className="border-none shadow-xl bg-background rounded-3xl">
        <CardHeader className="pb-4 border-b border-muted/20 bg-muted/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold">Search & Filters</CardTitle>
            </div>
            {(searchParams.get("restaurantSellerId") || searchParams.get("status") || searchParams.get("q")) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-muted-foreground hover:text-destructive transition-colors h-8 px-2 font-bold"
              >
                <X className="w-4 h-4 mr-1.5" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <Store className="w-4 h-4 text-slate-400" /> Restaurant
              </label>
              <Select 
                value={restaurantSearch} 
                onValueChange={setRestaurantSearch}
              >
                <SelectTrigger className="bg-slate-50 border border-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 h-10 rounded-xl">
                  <SelectValue placeholder="All Restaurants" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="ALL">All Restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <Filter className="w-4 h-4 text-slate-400" /> Status
              </label>
              <Select 
                value={statusSearch} 
                onValueChange={setStatusSearch}
              >
                <SelectTrigger className="bg-slate-50 border border-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 h-10 rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase().replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <User className="w-4 h-4 text-slate-400" /> Keywords
              </label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <Input 
                  placeholder="Order#, Customer Name, Phone..." 
                  className="pl-9 bg-slate-50 border border-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all rounded-xl"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                className="w-full h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Search className="w-3.5 h-3.5 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl overflow-hidden rounded-[2rem]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40 transition-none">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Order</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-bold uppercase tracking-widest text-slate-500">Customer</TableHead>
                <TableHead className="hidden lg:table-cell text-xs font-bold uppercase tracking-widest text-slate-500">Restaurant</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-bold uppercase tracking-widest text-slate-500">Date</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">Total</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Status</TableHead>
                <TableHead className="text-right pr-8 w-[100px] text-xs font-bold uppercase tracking-widest text-slate-500">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                      <div className="p-4 bg-muted rounded-full">
                        <ShoppingBag className="h-12 w-12 text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">No orders found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search terms</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 rounded-full">Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.flatMap((order) => {
                  const isExpanded = expandedRows.has(order.id)
                  return [
                    <TableRow key={order.id} className={`group transition-all hover:bg-muted/10 border-b border-muted/10 ${isExpanded ? "bg-muted/5" : ""}`}>
                      <TableCell className="pl-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full" 
                          onClick={() => toggleRow(order.id)}
                        >
                          {isExpanded ? <X className="h-4 w-4 text-slate-600" /> : <ChevronRight className={`h-4 w-4 text-slate-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />}
                        </Button>
                      </TableCell>
                      <TableCell className="py-5 font-bold text-slate-800">
                        <Link href={`/admin/restaurant-orders/${order.id}`} className="hover:text-emerald-600 transition-colors flex items-center gap-1">
                          #{order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-bold text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-50 rounded-lg">
                            <User className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">{order.customerName}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-medium">{order.customerEmail}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-amber-50 rounded-lg">
                            <Store className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <span className="text-sm font-bold text-slate-700 line-clamp-1">
                            {order.restaurantName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-slate-400 text-xs font-bold tabular-nums">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-900 text-base tabular-nums">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={`capitalize font-bold text-[10px] tracking-widest px-3 py-1 rounded-full border-none shadow-sm ${
                            order.status === "DELIVERED" ? "bg-emerald-500 text-white" :
                            order.status === "CANCELLED" ? "bg-rose-600 text-white" :
                            order.status === "PROCESSING" ? "bg-blue-500 text-white" :
                            "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {order.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-300">
                            <Link href={`/admin/restaurant-orders/${order.id}`}>
                              <ChevronRight className="w-5 h-5 text-emerald-600" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${order.id}-expanded`} className="bg-slate-50/50 border-b border-muted/10">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-6 bg-gradient-to-r from-emerald-50/10 to-transparent animate-in slide-in-from-top-2 duration-300">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                              <Utensils className="w-4 h-4 text-emerald-600" /> Food Items ({order.items.length})
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-500/30 transition-colors">
                                  <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.foodName} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                                        <Utensils className="h-8 w-8" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <p className="font-bold text-slate-800 text-sm truncate">{item.foodName}</p>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      <span>Qty: {item.quantity}</span>
                                      <span>{formatCurrency(item.price)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs font-bold text-slate-700">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  ]
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-8 bg-muted/10 border-t border-muted/20">
          <AdminPagination
            basePath="/admin/restaurant-orders"
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={perPage}
            params={searchParams}
          />
        </div>
      </Card>
    </div>
  )
}
