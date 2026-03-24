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
import { Package, ShoppingBag, Plus, Minus, Loader2, ShoppingCart, ArrowRight } from "lucide-react"

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
      return {
        label: "Return",
        text: `${item.returnPolicyDays} day${item.returnPolicyDays === 1 ? "" : "s"}`,
        className: "text-emerald-700",
      }
    }
    return { label: "No return", text: "", className: "text-slate-600" }
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My Orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          View and track your order history. Expand an order to see full details.
        </p>
      </div>

      {/* Tabs: Product orders | Service orders */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:min-w-[280px] sm:w-auto">
        <button
          type="button"
          onClick={() => setTabAndCollapse("product")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-medium transition-colors ${
            tab === "product"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Package className="h-4 w-4" />
          Product orders ({productOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTabAndCollapse("service")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-medium transition-colors ${
            tab === "service"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Service orders ({serviceOrders.length})
        </button>
      </div>

      {displayOrders.length === 0 ? (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-14 w-14 text-slate-300 sm:h-16 sm:w-16" />
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
        <ul className="space-y-3">
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
                <Card className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-0">
                    {/* Accordion header: always visible */}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 sm:text-lg">
                          Order #{order.orderNumber}
                        </p>
                        <p className="truncate text-sm text-slate-600">
                          {order.seller?.store?.name ?? "Store"} • {formatDate(order.createdAt)}
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
                            className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            {expandedItems[order.id] ? "View less" : "View more"}
                          </button>
                        )}
                        {statusSummary ? <p className="mt-0.5 text-[11px] text-slate-400">{statusSummary}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(order.totalAmount)}
                          </p>
                          <Badge
                            variant="outline"
                            className="mt-1 capitalize text-slate-600"
                          >
                            {displayStatus.toLowerCase().replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleDetail(order.id)}
                          disabled={loadingId !== null && loadingId !== order.id}
                          className="h-10 w-10 shrink-0 border-slate-300"
                          aria-label={isExpanded ? "Close details" : "Expand details"}
                        >
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                          ) : isExpanded ? (
                            <Minus className="h-5 w-5 text-slate-700" />
                          ) : (
                            <Plus className="h-5 w-5 text-slate-700" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Accordion body: expand to show details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-4 sm:px-5 sm:pb-5">
                        {isLoading ? (
                          <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
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
