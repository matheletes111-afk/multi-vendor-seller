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
import type { AdminOrderListItemApi } from "@/app/api/admin/orders/types"
import { ADMIN_ORDER_STATUSES } from "@/app/api/admin/orders/types"
import { ShoppingBag, User, Store, Search, Filter, X, ChevronRight, Package } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

export function AdminOrdersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10 
  const activeTab = searchParams.get("type") || "PRODUCT"

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

  // Filter states (local for the search button)
  const [sellerSearch, setSellerSearch] = useState(searchParams.get("seller") || "")
  const [customerSearch, setCustomerSearch] = useState(searchParams.get("customer") || "")
  const [statusSearch, setStatusSearch] = useState(searchParams.get("status") || "")

  // Update local state when URL changes (e.g. on clear or initial load)
  useEffect(() => {
    setSellerSearch(searchParams.get("seller") || "")
    setCustomerSearch(searchParams.get("customer") || "")
    setStatusSearch(searchParams.get("status") || "")
  }, [searchParams])

  const [data, setData] = useState<{
    orders: AdminOrderListItemApi[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("perPage", "10")
    return `/api/admin/orders?${params.toString()}`
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(fetchUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchUrl])

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (sellerSearch) params.set("seller", sellerSearch)
    else params.delete("seller")
    
    if (customerSearch) params.set("customer", customerSearch)
    else params.delete("customer")
    
    if (statusSearch && statusSearch !== "null") params.set("status", statusSearch)
    else params.delete("status")
    
    params.set("page", "1")
    params.set("type", activeTab)
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("type", value)
    params.set("page", "1")
    // Keep internal filters? User said "separate search", so maybe clear them when switching?
    // Actually, usually it's better to clear them if switching between products and services.
    params.delete("seller")
    params.delete("customer")
    params.delete("status")
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    setSellerSearch("")
    setCustomerSearch("")
    setStatusSearch("")
    const params = new URLSearchParams()
    params.set("type", activeTab)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (loading && !data) return <PageLoader variant="listing" message="Loading orders…" />

  const orders = data?.orders ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground tracking-tight">Order Management</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Monitor and process all customer orders</p>
        </div>
      </div>

      <Tabs defaultValue="PRODUCT" value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/50 p-1.5 h-12 rounded-2xl border border-muted/20 w-full sm:w-auto">
          <TabsTrigger value="PRODUCT" className="rounded-xl px-8 font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-lg active:scale-95 transition-all">
            <Package className="w-4 h-4" />
            Product Orders
          </TabsTrigger>
          <TabsTrigger value="SERVICE" className="rounded-xl px-8 font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-lg active:scale-95 transition-all">
            <ShoppingBag className="w-4 h-4" />
            Service Orders
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-4 py-1.5 text-xs font-semibold rounded-full shadow-sm bg-background border-primary/20 text-primary uppercase tracking-wider">
            {totalCount} {activeTab === "PRODUCT" ? "Product" : "Service"} Orders
          </Badge>
        </div>

      <Card className="border-none shadow-xl bg-background">
        <CardHeader className="pb-4 border-b border-muted/20 bg-muted/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-medium">Search & Filters</CardTitle>
            </div>
            {(searchParams.get("seller") || searchParams.get("customer") || searchParams.get("status")) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-muted-foreground hover:text-destructive transition-colors h-8 px-2"
              >
                <X className="w-4 h-4 mr-1.5" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground/80 lowercase tracking-wider">
                <Store className="w-4 h-4" /> Seller Store
              </label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Store name..." 
                  className="pl-9 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary transition-all rounded-xl"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground/80 lowercase tracking-wider">
                <User className="w-4 h-4" /> Customer Name
              </label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="John Doe..." 
                  className="pl-9 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary transition-all rounded-xl"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-foreground/80 lowercase tracking-wider">
                <Filter className="w-4 h-4" /> Status
              </label>
              <Select 
                value={statusSearch} 
                onValueChange={setStatusSearch}
              >
                <SelectTrigger className="bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary h-10 rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="null">All Statuses</SelectItem>
                  {ADMIN_ORDER_STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase().replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                className="w-full h-10 rounded-xl font-medium uppercase tracking-widest text-[10px] bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Search className="w-3.5 h-3.5 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40 transition-none">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="py-5 text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Order</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Customer</TableHead>
                <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Store</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Date</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Total</TableHead>
                <TableHead className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Status</TableHead>
                <TableHead className="text-right pr-8 w-[100px] text-xs font-medium uppercase tracking-widest text-muted-foreground/80">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                      <div className="p-4 bg-muted rounded-full">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">No orders found</h3>
                        <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or search terms</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 rounded-full">Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.flatMap((order) => {
                  const isExpanded = expandedRows.has(order.id)
                  return [
                    <TableRow key={order.id} className={`group transition-all hover:bg-muted/20 border-b border-muted/30 ${isExpanded ? "bg-muted/10" : ""}`}>
                      <TableCell className="pl-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full" 
                          onClick={() => toggleRow(order.id)}
                        >
                          {isExpanded ? <X className="h-4 w-4" /> : <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />}
                        </Button>
                      </TableCell>
                      <TableCell className="py-5 font-medium">
                        <Link href={`/admin/orders/${order.id}`} className="hover:text-primary transition-colors flex items-center gap-1">
                          #{order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-medium">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/5 rounded-lg">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm">{order.customerName || "—"}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{order.customerEmail || ""}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-orange-500/5 rounded-lg">
                            <Store className="h-3.5 w-3.5 text-orange-500" />
                          </div>
                          <span className="text-sm font-medium text-foreground/80 line-clamp-1">
                            {order.sellerStoreName ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs font-medium tabular-nums">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-lg tabular-nums">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={`capitalize font-medium text-[10px] tracking-widest px-3 py-1 rounded-full border-none shadow-sm shadow-black/5 ${
                            order.status === "DELIVERED" ? "bg-green-500 text-white" :
                            order.status === "CANCELLED" ? "bg-destructive text-white" :
                            order.status === "PROCESSING" ? "bg-blue-500 text-white" :
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {order.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild className="h-8 rounded-xl border-primary/20 hover:bg-primary/5 text-primary">
                            <Link href={`/admin/orders/${order.id}/invoice`} target="_blank">
                              Invoice
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-full hover:bg-primary hover:text-primary-foreground group-hover:scale-110 transition-all duration-300">
                            <Link href={`/admin/orders/${order.id}`}>
                              <ChevronRight className="w-5 h-5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${order.id}-expanded`} className="bg-muted/5 border-b border-muted/30">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-6 bg-gradient-to-r from-muted/20 to-transparent animate-in slide-in-from-top-2 duration-300">
                            <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                              <ShoppingBag className="w-4 h-4" /> Order Items ({order.items.length})
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex gap-4 p-4 bg-background rounded-2xl shadow-sm border border-muted/50 hover:border-primary/30 transition-colors">
                                  <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-muted border border-muted shadow-inner">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.productName || item.serviceName || "Item"} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                                        <ShoppingBag className="h-8 w-8" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <p className="font-medium text-sm truncate">{item.productName || item.serviceName || "Item"}</p>
                                    <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                      <span>Qty: {item.quantity}</span>
                                      <span>{formatCurrency(item.price)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                      <Badge variant="outline" className="text-[9px] font-medium uppercase tracking-tighter h-5 border-primary/20 bg-primary/5 text-primary">
                                        {item.status.replace(/_/g, " ").toLowerCase()}
                                      </Badge>
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
            basePath="/admin/orders"
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={perPage}
            params={searchParams}
          />
        </div>
      </Card>
      </Tabs>
    </div>
  )
}
