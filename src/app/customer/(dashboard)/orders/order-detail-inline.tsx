"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { Package, MapPin, Banknote, Receipt, ShoppingBag, Minus } from "lucide-react"

export function OrderDetailInline({
  order,
  onClose,
}: {
  order: OrderDetailApi
  onClose: () => void
}) {
  const itemName = (item: OrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"
  const lineTotal = (item: OrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details" className="shrink-0 -mr-2">
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize text-xs">{order.status.toLowerCase()}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{order.sellerStoreName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.paymentMethod ?? "—"} ({order.paymentStatus.toLowerCase()})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-lg border bg-background/50 p-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted sm:h-16 sm:w-16">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={itemName(item)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  <p className="font-medium">{itemName(item)}</p>
                  {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                    <p className="text-muted-foreground text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                    <span>Qty: {item.quantity}</span>
                    <span>× {formatCurrency(item.price)}</span>
                    {item.hasGst && <span className="text-emerald-600 dark:text-emerald-400">GST: {formatCurrency(item.gstAmount)}</span>}
                  </div>
                  <p className="font-semibold">Line total: {formatCurrency(lineTotal(item))}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Price breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal ({order.items.length} item(s))</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (GST)</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
          )}
          {order.shipping > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatCurrency(order.shipping)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Grand total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
