"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { Package, MapPin, Banknote, ArrowLeft, Receipt, ShoppingBag } from "lucide-react"

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [returnLoadingItemId, setReturnLoadingItemId] = useState<string | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchOrder = useCallback(async () => {
    setNotFound(false)
    const res = await fetch(`/api/customer/orders/${orderId}`, { credentials: "include" })
    if (res.status === 404) {
      setNotFound(true)
      return
    }
    if (!res.ok) return
    const data = (await res.json()) as OrderDetailApi
    setOrder(data)
  }, [orderId])

  useEffect(() => {
    fetchOrder().finally(() => setLoading(false))
  }, [fetchOrder])

  const handleRequestReturn = (itemId: string) => {
    setReturnError(null)
    setReturnLoadingItemId(itemId)
    fetch(`/api/customer/orders/${orderId}/items/${itemId}/return-request`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? "Failed to request return")
        }
        return fetchOrder()
      })
      .catch((err: Error) => setReturnError(err.message))
      .finally(() => setReturnLoadingItemId(null))
  }

  const canCancelOrder = !!order && order.items.length > 0 && order.items.every((item) => item.itemStatus === "PENDING")
  const handleCancelOrder = () => {
    if (!order || !canCancelOrder || cancelLoading) return
    setCancelError(null)
    setCancelLoading(true)
    fetch(`/api/customer/orders/${order.id}/cancel`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? "Failed to cancel order")
        }
        return fetchOrder()
      })
      .catch((err: Error) => setCancelError(err.message))
      .finally(() => setCancelLoading(false))
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading order…</p>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Order not found.</p>
            <Button asChild variant="outline">
              <Link href="/customer/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const itemName = (item: OrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"

  const lineTotal = (item: OrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount
  const returnLabel = (item: OrderDetailApi["items"][number]) => {
    if (item.returnAvailable) {
      const days = item.returnPolicyDays ?? 0
      return days > 0 ? `Return (${days} days)` : "Return"
    }
    return "No return"
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customer/orders" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order details</h1>
        <p className="text-muted-foreground mt-1">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </p>
      </div>

      {/* 4-panel grid: Summary | Delivery address | Items (with images & price breakup) | Price breakdown */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Panel 1: Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize">
                {order.status.toLowerCase()}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{order.sellerStoreName ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.paymentMethod ?? "—"} ({order.paymentStatus.toLowerCase()})</span>
            </div>
            {canCancelOrder && (
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={handleCancelOrder} disabled={cancelLoading}>
                  {cancelLoading ? "Cancelling..." : "Cancel Order"}
                </Button>
              </div>
            )}
            {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
          </CardContent>
        </Card>

        {/* Panel 2: Delivery address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.shippingFullName && (
              <>
                <p className="font-medium text-foreground">{order.shippingFullName}</p>
                {order.shippingPhone && <p>{order.shippingPhone}</p>}
                {order.shippingAddressLine1 && (
                  <p className="mt-1">
                    {order.shippingAddressLine1}
                    {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                    <br />
                    {order.shippingCity}
                    {order.shippingState && `, ${order.shippingState}`}
                    {order.shippingPostalCode && ` ${order.shippingPostalCode}`}
                    {order.shippingCountry && `, ${order.shippingCountry}`}
                  </p>
                )}
                {!order.shippingAddressLine1 && !order.shippingFullName && <p>—</p>}
              </>
            )}
            {!order.shippingFullName && <p>—</p>}
          </CardContent>
        </Card>
      </div>

      {/* Panel 3: Items with image, quantity, unit price, GST, line total */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white sm:h-20 sm:w-20">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={itemName(item)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Package className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{itemName(item)}</p>
                    <Badge
                      variant="outline"
                      className={item.returnAvailable ? "text-[10px] font-semibold text-emerald-700 border-emerald-300" : "text-[10px] font-semibold text-slate-600"}
                    >
                      {returnLabel(item)}
                    </Badge>
                  </div>
                  {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                    <p className="text-slate-600 text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                  )}
                  {item.returnAvailable && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">Return: {item.returnRequestStatus ?? "ELIGIBLE"}</Badge>
                      <Badge variant="outline">Pickup: {item.pickupStatus ?? "NOT_REQUESTED"}</Badge>
                      <Badge variant="outline">Refund: {item.refundStatus ?? "NOT_REQUESTED"}</Badge>
                      {item.itemStatus === "DELIVERED" && !item.returnRequestStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestReturn(item.id)}
                          disabled={returnLoadingItemId === item.id}
                        >
                          {returnLoadingItemId === item.id ? "Requesting..." : "Request Return"}
                        </Button>
                      )}
                    </div>
                  )}
                  {item.deliveryProofImage && (
                    <a
                      href={item.deliveryProofImage}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-blue-600 underline"
                    >
                      View delivery proof
                    </a>
                  )}
                  {item.statusHistory.length > 0 && (
                    <div className="mt-1 rounded-md border bg-white/80 p-2">
                      <p className="mb-1 text-[11px] font-semibold text-slate-700">Tracking timeline</p>
                      <ul className="space-y-1.5">
                        {item.statusHistory.map((h, idx) => (
                          <li key={`${item.id}-hist-${idx}`} className="relative pl-4 text-[11px] text-slate-600">
                            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-slate-400" />
                            <span className="font-medium text-slate-700">{h.status}</span>
                            {h.location ? ` • ${h.location}` : ""}
                            {h.note ? ` • ${h.note}` : ""}
                            <span className="block text-[10px] text-slate-500">
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-600">
                    <span>Qty: {item.quantity}</span>
                    <span>× {formatCurrency(item.price)}</span>
                    <span className="font-medium text-slate-700">
                      Subtotal: {formatCurrency(item.subtotal)}
                    </span>
                    {item.hasGst ? (
                      <span className="text-xs text-emerald-700">
                        GST: {formatCurrency(item.gstAmount)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No GST</span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900">
                    Line total: {formatCurrency(lineTotal(item))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {returnError && <p className="text-sm text-destructive">{returnError}</p>}

      {/* Panel 4: Price breakdown (grand total) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Price breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({order.items.length} item(s))</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total GST</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>

          <div className="mt-1 space-y-1.5">
            {order.items.map((item) => {
              const gst = item.hasGst ? item.gstAmount : 0
              const totalInclGst = item.subtotalInclGst ?? item.subtotal + gst
              return (
                <div key={item.id} className="flex justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.productNameSnapshot || item.serviceNameSnapshot || "Item"} (x{item.quantity})
                  </span>
                  <span className="text-right">
                    <span className="text-muted-foreground">
                      {formatCurrency(item.subtotal)} {gst > 0 ? `+ GST ${formatCurrency(gst)}` : "+ No GST"}
                    </span>
                    <span className="block font-medium text-slate-900">{formatCurrency(totalInclGst)}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {order.shipping > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatCurrency(order.shipping)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Grand total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
