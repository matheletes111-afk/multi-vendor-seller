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
import { Package, ShoppingBag, ChevronDown, Loader2, ArrowRight } from "lucide-react"
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
  }[]
}

function itemLabel(order: OrderListItem) {
  return order.items.map((i) => (i.productNameSnapshot || i.serviceNameSnapshot || "Item") + " × " + i.quantity).join(", ")
}

function isReturnableItem(item: OrderListItem["items"][number]) {
  return !item.serviceId && item.returnPolicyType === "RETURNABLE" && (item.returnPolicyDays ?? 0) > 0
}

function returnMeta(item: OrderListItem["items"][number]) {
  if (isReturnableItem(item)) {
    return {
      label: "Return",
      text: `${item.returnPolicyDays} day${item.returnPolicyDays === 1 ? "" : "s"}`,
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
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg border bg-muted/30 p-1 w-full sm:w-auto sm:min-w-[280px]">
        <button
          type="button"
          onClick={() => setTabAndPage("product")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            type === "product" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Product orders ({tabCounts.product})
        </button>
        <button
          type="button"
          onClick={() => setTabAndPage("service")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            type === "service" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Service orders ({tabCounts.service})
        </button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Store</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell max-w-[220px]">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[140px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <Fragment key={order.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        #{order.orderNumber}
                        <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                          {order.seller?.store?.name ?? "Store"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {order.seller?.store?.name ?? "Store"}
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
                          <Badge variant="outline" className="text-[10px]">
                            Returnable {order.items.filter(isReturnableItem).length}/{order.items.length}
                          </Badge>
                        </div>
                        {order.items.length > 2 && (
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
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs whitespace-nowrap">
                          {order.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
                          {expandedId === order.id ? "Hide" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === order.id && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-4 sm:p-5">
                          {loadingId === order.id ? (
                            <div className="py-8 flex justify-center text-muted-foreground">
                              <Loader2 className="h-8 w-8 animate-spin" />
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
          <div className="px-6 pb-6">
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
