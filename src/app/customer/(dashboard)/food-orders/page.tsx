"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Utensils,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  Search,
  Store,
  Calendar,
  AlertCircle,
  Receipt,
  MapPin
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type OrderItem = {
  id: string
  foodItemId: string
  foodName: string
  foodImage: string | null
  quantity: number
  price: number
  subtotal: number
}

type FoodOrderDetails = {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
  deliveryFullName: string
  deliveryPhone: string
  deliveryAddressLine1: string
  deliveryAddressLine2: string | null
  deliveryCity: string
  deliveryState: string
  deliveryPostalCode: string
  deliveryCountry: string
  restaurantName: string
  items: OrderItem[]
}

type FoodOrderItemSummary = {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: number
  status: string
  restaurantName: string
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All Orders" },
  { value: "PENDING", label: "Pending" },
  { value: "PREPARING", label: "Preparing" },
  { value: "OUT_FOR_DELIVERY", label: "Out For Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" }
]

function orderStatusPillClass(status: string) {
  const s = status.toUpperCase()
  if (s === "DELIVERED") return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
  if (s === "PENDING") return "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
  if (s === "PREPARING") return "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
  if (s === "OUT_FOR_DELIVERY") return "rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800"
  if (s === "CANCELLED") return "rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800"
  return "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800"
}

export default function CustomerFoodOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = 10
  const activeStatus = searchParams.get("status") || "ALL"
  const initialSearch = searchParams.get("q") || ""

  const [orders, setOrders] = useState<FoodOrderItemSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialSearch)

  // Accordion details state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<string, FoodOrderDetails | null>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)

  const loadOrders = useCallback(() => {
    setLoading(true)
    const url = `/api/customer/foods/orders?page=${page}&perPage=${perPage}&status=${activeStatus}&q=${encodeURIComponent(searchQuery)}`
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.success) {
          setOrders(json.data)
          setTotalCount(json.pagination?.totalCount ?? 0)
          setTotalPages(json.pagination?.totalPages ?? 1)
        } else {
          setOrders([])
          setTotalCount(0)
          setTotalPages(1)
        }
      })
      .catch(() => {
        setOrders([])
        setTotalCount(0)
        setTotalPages(1)
      })
      .finally(() => setLoading(false))
  }, [page, perPage, activeStatus, searchQuery])

  useEffect(() => {
    loadOrders()
  }, [page, activeStatus])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", "1")
    params.set("q", searchQuery)
    router.replace(`/customer/food-orders?${params.toString()}`)
    loadOrders()
  }

  const selectStatusFilter = (statusVal: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", "1")
    params.set("status", statusVal)
    router.replace(`/customer/food-orders?${params.toString()}`)
  }

  const navigatePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    router.replace(`/customer/food-orders?${params.toString()}`)
  }

  const toggleTrackDetails = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
      return
    }

    if (orderDetails[orderId]) {
      setExpandedOrderId(orderId)
      return
    }

    setLoadingDetailId(orderId)
    try {
      const res = await fetch(`/api/customer/foods/orders/${orderId}`, { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setOrderDetails(prev => ({ ...prev, [orderId]: data.data }))
        setExpandedOrderId(orderId)
      }
    } catch (err) {
      console.error("Failed to load order details:", err)
    } finally {
      setLoadingDetailId(null)
    }
  }

  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6 font-sans antialiased space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[24px]">
          Food Orders
          <span className="mt-2 block h-1 w-14 rounded-full bg-amber-500" aria-hidden />
        </h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          Track and manage your restaurant/food orders history.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food orders by # or restaurant..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none ring-amber-500/20 transition-all duration-200 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2"
            aria-label="Search food orders"
          />
        </form>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => selectStatusFilter(filter.value)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                activeStatus === filter.value
                  ? "border-amber-500 bg-amber-50 text-amber-800 shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-gray-500">
          <Loader2 className="h-9 w-9 animate-spin text-amber-500" aria-hidden />
        </div>
      ) : orders.length === 0 ? (
        <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
          <CardContent className="space-y-4 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-gray-500 font-medium">No food orders found.</p>
            <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
              <Link href="/foods">
                Browse Restaurants
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500 py-4">Order ID</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500">Restaurant</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500">Date</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500 text-right">Total Amount</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-500 text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id
                  const isDetailLoading = loadingDetailId === order.id
                  const details = orderDetails[order.id]

                  return (
                    <Fragment key={order.id}>
                      <TableRow className="border-b border-slate-100 transition-colors duration-150 hover:bg-slate-50/20">
                        <TableCell className="font-mono text-sm font-semibold text-slate-700 py-4">
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                            <Store className="h-4 w-4 text-slate-400" />
                            {order.restaurantName}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(order.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-black text-slate-900">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className={orderStatusPillClass(order.status)}>
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingDetailId !== null && loadingDetailId !== order.id}
                            onClick={() => toggleTrackDetails(order.id)}
                            className="rounded-lg border-amber-200 bg-amber-50/50 text-amber-800 font-bold hover:bg-amber-100 flex gap-1.5 ml-auto"
                          >
                            {isDetailLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            Track Details
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && details && (
                        <TableRow className="border-b border-slate-100 bg-slate-50/30 hover:bg-slate-50/30">
                          <TableCell colSpan={6} className="p-6">
                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                              {/* Timeline progress indicator */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Progress</h4>
                                <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold tracking-wider uppercase text-slate-400">
                                  {["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"].map((step, idx) => {
                                    const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"]
                                    const currentIdx = statuses.indexOf(details.status)
                                    const isDone = currentIdx >= idx
                                    const isActive = currentIdx === idx

                                    return (
                                      <div key={step} className="space-y-1">
                                        <div className={`h-1.5 rounded-full mx-1 ${
                                          isDone ? "bg-amber-500" : "bg-slate-200"
                                        } ${isActive ? "animate-pulse bg-amber-500" : ""}`} />
                                        <span className={`block font-bold text-[9px] sm:text-[10px] ${
                                          isActive ? "text-amber-600" : isDone ? "text-slate-800" : "text-slate-400"
                                        }`}>
                                          {step === "PROCESSING" ? "Preparing" : step.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Items list column */}
                                <div className="md:col-span-2 space-y-3">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Receipt className="h-4 w-4" /> Items Ordered
                                  </h4>
                                  <div className="space-y-2">
                                    {details.items.map((item) => (
                                      <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-center gap-3">
                                          <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                            {item.foodImage ? (
                                              <img src={item.foodImage} alt={item.foodName} className="object-cover h-full w-full" />
                                            ) : (
                                              "Food"
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-sm font-bold text-slate-800">{item.foodName}</p>
                                            <p className="text-xs text-slate-400 font-bold mt-0.5">{formatCurrency(item.price)} each</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-bold text-slate-900">{formatCurrency(item.subtotal)}</p>
                                          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Quantity: {item.quantity}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Address delivery info column */}
                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" /> Delivery Address
                                  </h4>
                                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm text-xs font-semibold text-slate-600 leading-relaxed">
                                    <div>
                                      <p className="font-bold text-slate-800 text-sm leading-none">{details.deliveryFullName}</p>
                                      <p className="text-[10px] text-slate-400 font-bold mt-1">Phone: {details.deliveryPhone}</p>
                                    </div>
                                    <hr className="border-slate-100" />
                                    <p>
                                      {details.deliveryAddressLine1}
                                      {details.deliveryAddressLine2 && `, ${details.deliveryAddressLine2}`}
                                      <br />
                                      {details.deliveryCity}, {details.deliveryState} - {details.deliveryPostalCode}
                                      <br />
                                      {details.deliveryCountry}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <span className="text-xs font-bold text-slate-500">
                Showing Page {page} of {totalPages} ({totalCount} total orders)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => navigatePage(page - 1)}
                  className="rounded-lg h-9"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => navigatePage(page + 1)}
                  className="rounded-lg h-9"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
