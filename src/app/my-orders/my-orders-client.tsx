"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { OrderDetailInline } from "@/app/customer/(dashboard)/orders/order-detail-inline"
import { deriveOrderStatus } from "@/lib/order-status"
import {
  Package,
  ShoppingBag,
  Plus,
  Minus,
  Loader2,
  ShoppingCart,
  ArrowRight,
  Search,
  Store,
} from "lucide-react"

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
    itemStatus: string
    returnPolicyType: "RETURNABLE" | "NON_RETURNABLE" | null
    returnPolicyDays: number | null
    replacementAllowed?: boolean
  }[]
}

function isProductOrder(order: OrderListItem) {
  return order.items.some((i) => i.productId != null)
}
function isServiceOrder(order: OrderListItem) {
  return order.items.some((i) => i.serviceId != null)
}

export function MyOrdersClient({ orders }: { orders: OrderListItem[] }) {
  const [tab, setTab] = useState<"product" | "service">("product")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetailApi | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const productOrders = orders.filter(isProductOrder)
  const serviceOrders = orders.filter(isServiceOrder)
  const setTabAndCollapse = (newTab: "product" | "service") => {
    setTab(newTab)
    setExpandedId(null)
    setDetail(null)
  }
  const displayOrders = tab === "product" ? productOrders : serviceOrders

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    const res = await fetch(`/api/customer/orders/${orderId}`, { credentials: "include" })
    if (!res.ok) throw new Error("Failed to fetch order detail")
    return (await res.json()) as OrderDetailApi
  }, [])

  const toggleDetail = useCallback(
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

  const itemLabel = (items: OrderListItem["items"]) =>
    items.map((i) => (i.productNameSnapshot || i.serviceNameSnapshot || "Item") + " × " + i.quantity).join(", ")

  const returnMeta = (item: OrderListItem["items"][number]) => {
    if (!item.serviceId && item.returnPolicyType === "RETURNABLE" && (item.returnPolicyDays ?? 0) > 0) {
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

  return (
    <div className="space-y-6 font-sans">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[24px]">
          My Orders
          <span className="mt-2 block h-1 w-14 rounded-full bg-blue-600" aria-hidden />
        </h1>
        <p className="mt-3 text-sm text-gray-600 sm:text-base">
          View and track your order history. Expand an order to see full details.
        </p>
      </div>

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

      {/* Tabs: Product orders | Service orders */}
      <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-1 sm:min-w-[300px] sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={() => setTabAndCollapse("product")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 ${
            tab === "product"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
          }`}
        >
          <Package className="h-4 w-4 shrink-0" />
          Product orders ({productOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTabAndCollapse("service")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 ${
            tab === "service"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
          }`}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" />
          Service orders ({serviceOrders.length})
        </button>
      </div>

      {displayOrders.length === 0 ? (
        <Card className="overflow-hidden rounded-xl border border-[#f0f0f0] shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-14 w-14 text-gray-300 sm:h-16 sm:w-16" />
            <h3 className="mt-4 text-lg font-semibold text-slate-800">
              {tab === "product" ? "No product orders yet" : "No service orders yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              {tab === "product"
                ? "Your product orders will appear here."
                : "Your service orders will appear here."}
            </p>
            <Button asChild className="mt-6">
              <Link href="/browse">
                Browse
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {displayOrders.map((order) => {
            const visibleItems =
              tab === "product" ? order.items.filter((i) => i.productId != null) : order.items.filter((i) => i.serviceId != null)
            const displayStatus = deriveOrderStatus(visibleItems.map((i) => i.itemStatus as any))
            const statusCounts = visibleItems.reduce<Record<string, number>>((acc, i) => {
              acc[i.itemStatus] = (acc[i.itemStatus] ?? 0) + 1
              return acc
            }, {})
            const statusSummary = Object.entries(statusCounts)
              .slice(0, 3)
              .map(([s, c]) => `${s.toLowerCase().replace(/_/g, " ")} (${c})`)
              .join(", ")
            const isExpanded = expandedId === order.id
            const isLoading = loadingId === order.id
            return (
              <li key={order.id}>
                <Card className="overflow-hidden rounded-xl border border-[#f0f0f0] bg-white shadow-sm transition-all duration-200 ease-out hover:shadow-md">
                  <CardContent className="p-0">
                    {/* Accordion header: always visible */}
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="mt-0.5 h-10 w-10 shrink-0 rounded-md bg-gray-100 ring-1 ring-gray-200/80" aria-hidden />
                        <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-medium text-gray-500">#{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
                          <Store className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                          {order.seller?.store?.name ?? "Store"}
                        </p>
                        {expandedItems[order.id] ? (
                          <div className="mt-1 space-y-1 text-sm text-slate-500">
                            {visibleItems.map((item) => {
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
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {itemLabel(visibleItems)}
                          </p>
                        )}
                        {!expandedItems[order.id] && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {visibleItems.slice(0, 2).map((item) => {
                              const meta = returnMeta(item)
                              const name = item.productNameSnapshot || item.serviceNameSnapshot || "Item"
                              return (
                                <Badge key={item.id} variant="outline" className="text-[10px]">
                                  <span className="truncate max-w-[180px] inline-block align-bottom">{name}</span>
                                  <span className="mx-1 text-slate-300">|</span>
                                  <span className={`font-semibold ${meta.className}`}>{meta.label}</span>
                                  {meta.text ? <span className="text-slate-500"> ({meta.text})</span> : null}
                                </Badge>
                              )
                            })}
                            {visibleItems.length > 2 && (
                              <Badge variant="outline" className="text-[10px] text-slate-500">
                                +{visibleItems.length - 2} more item(s)
                              </Badge>
                            )}
                          </div>
                        )}
                        {visibleItems.length > 2 && (
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
                        {statusSummary ? <p className="mt-0.5 text-[11px] text-gray-400">{statusSummary}</p> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                        <div className="text-right sm:min-w-[120px]">
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                          <span className={`mt-1 inline-block ${orderStatusPillClass(displayStatus)}`}>
                            {displayStatus.toLowerCase().replace(/_/g, " ")}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => toggleDetail(order.id)}
                          disabled={loadingId !== null && loadingId !== order.id}
                          className="h-10 shrink-0 gap-2 rounded-lg border-gray-300 px-4 font-medium shadow-sm transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 sm:h-10"
                          aria-label={isExpanded ? "Hide order details" : "Track order"}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isExpanded ? (
                            <Minus className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {isExpanded ? "Hide details" : "Track order"}
                        </Button>
                      </div>
                    </div>

                    {/* Accordion body: expand to show details */}
                    {isExpanded && (
                      <div className="border-t border-[#f0f0f0] bg-gray-50/50 px-5 pb-5 pt-1">
                        {isLoading ? (
                          <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          </div>
                        ) : detail && detail.id === order.id ? (
                          <OrderDetailInline order={detail} onClose={closeDetail} onReviewSaved={refreshDetail} />
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
