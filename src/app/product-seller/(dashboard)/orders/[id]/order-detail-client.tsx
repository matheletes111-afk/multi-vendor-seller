"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { SellerOrderDetailApi } from "@/app/api/product-seller/orders/types"
import { SELLER_ORDER_STATUSES } from "@/app/api/product-seller/orders/types"
import { Package, MapPin, User, ArrowLeft, Loader2, Receipt, Banknote, ShoppingBag } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

export function ProductSellerOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<SellerOrderDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [statusValue, setStatusValue] = useState<string>("")
  const [updateLoading, setUpdateLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const fetchOrder = useCallback(() => {
    return fetch(`/api/product-seller/orders/${orderId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        if (!res.ok) return null
        return res.json()
      })
      .then((data: SellerOrderDetailApi | null) => {
        if (data) {
          setOrder(data)
          setStatusValue(data.status)
        }
      })
  }, [orderId])

  useEffect(() => {
    setLoading(true)
    fetchOrder().finally(() => setLoading(false))
  }, [fetchOrder])

  const canUpdateStatus =
    order &&
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED"

  const handleUpdateStatus = () => {
    if (!order || !statusValue || statusValue === order.status || !canUpdateStatus) return
    if (statusValue === "CANCELLED" && order.status !== "PENDING") {
      setStatusError("Can only cancel orders that are PENDING")
      return
    }
    setStatusError(null)
    setUpdateLoading(true)
    fetch(`/api/product-seller/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: statusValue }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d: { error?: string }) => { throw new Error(d.error ?? "Failed") })
        return fetchOrder()
      })
      .catch((err: Error) => setStatusError(err.message))
      .finally(() => setUpdateLoading(false))
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
              <Link href="/product-seller/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const itemName = (item: SellerOrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"

  const lineTotal = (item: SellerOrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/product-seller/orders" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order details</h1>
        <p className="text-muted-foreground mt-1">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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
            {canUpdateStatus && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  disabled={updateLoading || statusValue === order.status}
                >
                  {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update status"}
                </Button>
                {statusError && (
                  <p className="text-sm text-destructive w-full">{statusError}</p>
                )}
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.paymentMethod ?? "—"} ({order.paymentStatus.toLowerCase()})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.shippingFullName ? (
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
              </>
            ) : (
              <p>—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium text-foreground">{order.customerName ?? order.customerEmail ?? "—"}</p>
            {order.customerEmail && order.customerName && (
              <p className="text-muted-foreground">{order.customerEmail}</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                  <p className="font-medium text-slate-900">{itemName(item)}</p>
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
          {order.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (GST)</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
          )}
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
