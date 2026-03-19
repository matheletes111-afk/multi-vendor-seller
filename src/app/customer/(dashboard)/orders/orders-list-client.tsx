"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { OrderDetailInline } from "./order-detail-inline"
import { Package, ShoppingBag, ChevronDown, Loader2 } from "lucide-react"

type OrderListItem = {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: number
  status: string
  seller: { store: { name: string | null } | null }
  items: { id: string; productId: string | null; serviceId: string | null; productNameSnapshot: string | null; serviceNameSnapshot: string | null; quantity: number; subtotal: number }[]
}

function isProductOrder(order: OrderListItem) {
  return order.items.some((i) => i.productId != null)
}
function isServiceOrder(order: OrderListItem) {
  return order.items.some((i) => i.serviceId != null)
}

export function OrdersListClient({ orders }: { orders: OrderListItem[] }) {
  const [tab, setTab] = useState<"product" | "service">("product")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetailApi | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const productOrders = orders.filter(isProductOrder)
  const setTabAndCollapse = (newTab: "product" | "service") => {
    setTab(newTab)
    setExpandedId(null)
    setDetail(null)
  }
  const serviceOrders = orders.filter(isServiceOrder)
  const displayOrders = tab === "product" ? productOrders : serviceOrders

  const loadDetail = useCallback(async (orderId: string) => {
    if (expandedId === orderId && detail) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(orderId)
    setDetail(null)
    setLoadingId(orderId)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, { credentials: "include" })
      if (res.ok) {
        const data: OrderDetailApi = await res.json()
        setDetail(data)
      } else {
        setExpandedId(null)
      }
    } catch {
      setExpandedId(null)
    } finally {
      setLoadingId(null)
    }
  }, [expandedId, detail])

  const closeDetail = useCallback(() => {
    setExpandedId(null)
    setDetail(null)
  }, [])

  const itemLabel = (order: OrderListItem) =>
    order.items.map((i) => (i.productNameSnapshot || i.serviceNameSnapshot || "Item") + " × " + i.quantity).join(", ")

  return (
    <div className="space-y-6">
      {/* Toggle: Product orders | Service orders */}
      <div className="flex rounded-lg border bg-muted/30 p-1 w-full sm:w-auto sm:min-w-[280px]">
        <button
          type="button"
          onClick={() => setTabAndCollapse("product")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "product" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Product orders ({productOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTabAndCollapse("service")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            tab === "service" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Service orders ({serviceOrders.length})
        </button>
      </div>

      {displayOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {tab === "product" ? "No product orders yet." : "No service orders yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {displayOrders.map((order) => (
            <li key={order.id}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-lg">Order #{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {order.seller?.store?.name ?? "Store"} • {formatDate(order.createdAt)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {itemLabel(order)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                        <Badge variant="outline" className="capitalize text-xs mt-1">{order.status.toLowerCase()}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadDetail(order.id)}
                        disabled={loadingId !== null && loadingId !== order.id}
                        className="gap-1.5"
                      >
                        {loadingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} />
                        )}
                        {expandedId === order.id ? "Hide details" : "View details"}
                      </Button>
                    </div>
                  </div>

                  {expandedId === order.id && (
                    <div className="border-t px-4 pb-4 sm:px-5 sm:pb-5">
                      {loadingId === order.id ? (
                        <div className="py-8 flex justify-center text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : detail && detail.id === order.id ? (
                        <OrderDetailInline order={detail} onClose={closeDetail} />
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
