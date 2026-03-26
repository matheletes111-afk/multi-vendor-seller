"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { OrderDetailInline } from "./order-detail-inline"
import {
  Package,
  ShoppingBag,
  ChevronDown,
  Loader2,
  ArrowRight,
  Search,
  Store,
} from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type OrderListItem = {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: number
  status: string
  seller: { store: { name: string | null } | null }
  items: {
    id: string
    productId: string | null
    serviceId: string | null
    productVariantId: string | null
    productNameSnapshot: string | null
    serviceNameSnapshot: string | null
    quantity: number
    subtotal: number
    returnPolicyType: "RETURNABLE" | "NON_RETURNABLE" | null
    returnPolicyDays: number | null
    replacementAllowed?: boolean
  }[]
}

function isReturnableItem(item: OrderListItem["items"][number]) {
  return !item.serviceId && item.returnPolicyType === "RETURNABLE" && (item.returnPolicyDays ?? 0) > 0
}

function orderStatusPillClass(status: string) {
  const s = status.toUpperCase()
  if (s.includes("REFUND")) return "rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
  if (s.includes("DELIVER")) return "rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800"
  if (s.includes("SHIP")) return "rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
  if (s.includes("CONFIRM") || s.includes("PROCESS")) return "rounded-full border border-green-200 bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
  if (s.includes("PENDING")) return "rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
  if (s.includes("CANCEL")) return "rounded-full border border-red-200 bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
  return "rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800"
}

function returnMeta(item: OrderListItem["items"][number]) {
  if (isReturnableItem(item)) {
    const days = `${item.returnPolicyDays} day${item.returnPolicyDays === 1 ? "" : "s"}`
    const ex = item.replacementAllowed ? " · Exchange available" : ""
    return {
      label: "Return",
      text: `${days}${ex}`,
      className: "text-emerald-700",
    }
  }
  return { label: "No return", text: "", className: "text-slate-600" }
}

export function OrdersListClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const type = searchParams.get("type") === "service" ? "service" : "product"

  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [tabCounts, setTabCounts] = useState({ product: 0, service: 0 })
  const [loading, setLoading] = useState(true)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetailApi | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const loadOrders = useCallback(() => {
    setLoading(true)
    return fetch(`/api/customer/orders?page=${page}&perPage=${perPage}&type=${type}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.orders) {
          setOrders(json.orders)
          setTotalCount(json.totalCount ?? 0)
          setTotalPages(json.totalPages ?? 1)
          if (json.tabCounts) setTabCounts(json.tabCounts)
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
  }, [page, perPage, type])

  useEffect(() => {
    setExpandedId(null)
    setDetail(null)
    loadOrders()
  }, [loadOrders])

  const setTabAndPage = (next: "product" | "service") => {
    router.replace(`/customer/orders?type=${next}&page=1`)
  }

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    const res = await fetch(`/api/customer/orders/${orderId}`, { credentials: "include" })
    if (!res.ok) throw new Error("Failed to fetch order detail")
    return (await res.json()) as OrderDetailApi
  }, [])

  const loadDetail = useCallback(
    async (orderId: string) => {
      if (expandedId === orderId && detail) {
        setExpandedId(null)
        setDetail(null)
        return
      }
      setExpandedId(orderId)
      setDetail(null)
      setLoadingId(orderId)
      try {
        const data = await fetchOrderDetail(orderId)
        setDetail(data)
      } catch {
        setExpandedId(null)
      } finally {
        setLoadingId(null)
      }
    },
    [expandedId, detail, fetchOrderDetail]
  )
  const refreshDetail = useCallback(
    async (orderId: string) => {
      setLoadingId(orderId)
      try {
        const data = await fetchOrderDetail(orderId)
        setDetail(data)
      } finally {
        setLoadingId(null)
      }
    },
    [fetchOrderDetail]
  )


  const closeDetail = useCallback(() => {
    setExpandedId(null)
    setDetail(null)
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-500">
        <Loader2 className="h-9 w-9 animate-spin text-blue-600" aria-hidden />
      </div>
    )
  }

  return (
    <div className="space-y-6 transition-all duration-200 ease-out">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            placeholder="Search orders..."
            className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none ring-blue-500/20 transition-all duration-200 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2"
            aria-label="Search orders"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All Orders", "Confirmed", "Shipped", "Delivered", "Refunded"] as const).map((label, i) => (
            <span
              key={label}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                i === 0
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                  : "cursor-default border-gray-200 bg-white text-gray-600"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-1 sm:w-auto sm:min-w-[300px] sm:flex-row sm:items-stretch">
        <button
          type="button"
          onClick={() => setTabAndPage("product")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 ${
            type === "product"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
          }`}
        >
          <Package className="h-4 w-4 shrink-0" />
          Product orders ({tabCounts.product})
        </button>
        <button
          type="button"
          onClick={() => setTabAndPage("service")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 ${
            type === "service"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
          }`}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" />
          Service orders ({tabCounts.service})
        </button>
      </div>

      {orders.length === 0 ? (
        <Card className="overflow-hidden rounded-xl border border-[#f0f0f0] shadow-sm">
          <CardContent className="space-y-4 py-14 text-center">
            <p className="text-gray-600">
              {type === "product" ? "No product orders yet." : "No service orders yet."}
            </p>
            {tabCounts.product === 0 && tabCounts.service === 0 && (
              <Button asChild>
                <Link href="/browse">
                  Start Shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-[#f0f0f0] shadow-sm transition-shadow duration-200 hover:shadow-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#f0f0f0] bg-gray-50/90 hover:bg-gray-50/90">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
                    Store
                  </TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                    Date
                  </TableHead>
                  <TableHead className="hidden max-w-[220px] text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                    Items
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</TableHead>
                  <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <Fragment key={order.id}>
                    <TableRow className="border-b border-[#f0f0f0] transition-colors duration-200 ease-out hover:bg-gray-50/80">
                      <TableCell className="align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-10 w-10 shrink-0 rounded-md bg-gray-100 ring-1 ring-gray-200/80" aria-hidden />
                          <div>
                            <p className="font-mono text-sm font-medium text-gray-500">#{order.orderNumber}</p>
                            <p className="mt-0.5 text-xs text-gray-500 sm:hidden">{formatDate(order.createdAt)}</p>
                            <p className="mt-1 text-xs text-gray-500 sm:hidden">{order.seller?.store?.name ?? "Store"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800">
                          <Store className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                          {order.seller?.store?.name ?? "Store"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground min-w-[320px] max-w-[420px]">
                        {expandedItems[order.id] ? (
                          <div className="space-y-1">
                            {order.items.map((item) => {
                              const name = item.productNameSnapshot || item.serviceNameSnapshot || "Item"
                              const meta = returnMeta(item)
                              return (
                                <p key={item.id} className="truncate">
                                  <span>{name} x {item.quantity}</span>
                                  <span className="mx-1.5 text-slate-300">|</span>
                                  <span className={`font-semibold ${meta.className}`}>{meta.label}</span>
                                  {meta.text ? <span className="text-slate-500"> ({meta.text})</span> : null}
                                </p>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item) => {
                              const name = item.productNameSnapshot || item.serviceNameSnapshot || "Item"
                              const meta = returnMeta(item)
                              return (
                                <p key={item.id} className="truncate">
                                  <span>{name} x {item.quantity}</span>
                                  <span className="mx-1.5 text-slate-300">|</span>
                                  <span className={`font-semibold ${meta.className}`}>{meta.label}</span>
                                  {meta.text ? <span className="text-slate-500"> ({meta.text})</span> : null}
                                </p>
                              )
                            })}
                            {order.items.length > 2 && (
                              <p className="text-xs text-muted-foreground">+{order.items.length - 2} more item(s)</p>
                            )}
                          </div>
                        )}
                        <div className="mt-1">
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
                            Returnable {order.items.filter(isReturnableItem).length}/{order.items.length}
                          </Badge>
                        </div>
                        {order.items.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedItems((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                            }
                            className="mt-1 text-xs font-medium text-blue-600 underline-offset-2 transition-colors duration-200 hover:underline"
                          >
                            {expandedItems[order.id] ? "View less" : "View more"}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right align-top">
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className={orderStatusPillClass(order.status)}>
                          {order.status.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadDetail(order.id)}
                          disabled={loadingId !== null && loadingId !== order.id}
                          className="gap-1.5 rounded-lg border-gray-300 font-medium shadow-sm transition-all duration-200 hover:border-gray-400 hover:bg-gray-50"
                        >
                          {loadingId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${expandedId === order.id ? "rotate-180" : ""}`}
                            />
                          )}
                          {expandedId === order.id ? "Hide details" : "Track order"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === order.id && (
                      <TableRow className="border-b border-[#f0f0f0] bg-gray-50/50 hover:bg-gray-50/50">
                        <TableCell colSpan={7} className="p-4 sm:p-5">
                          {loadingId === order.id ? (
                            <div className="flex justify-center py-10 text-gray-500">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                          ) : detail && detail.id === order.id ? (
                            <OrderDetailInline order={detail} onClose={closeDetail} onReviewSaved={refreshDetail} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-[#f0f0f0] bg-gray-50/50 px-6 py-5">
            <AdminPagination
              basePath="/customer/orders"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={{ type }}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
