"use client"

import { useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, Package, Truck, ShieldCheck, Home, ArrowRight, MapPin, Receipt, CreditCard } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { useCart } from "@/app/cart/cart-context"

export type SerializedOrder = {
  id: string
  orderNumber: string
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  shippingFullName: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingAddressLine1: string | null
  shippingAddressLine2?: string | null
  shippingPostalCode?: string | null
  shippingCountry?: string | null
  deliveryZoneLabel?: string
  shipping?: number
  weightShippingFee?: number
  dimensionShippingFee?: number
  regionShippingFee?: number
  createdAt: string
  items: {
    id: string
    productNameSnapshot: string | null
    quantity: number
    price: number
    subtotalInclGst: number | null
  }[]
} | null

export function OrderSuccessClient({ order }: { order: SerializedOrder }) {
  const { clearCart, refresh } = useCart()

  // Reset cart count to 0 upon order confirmation
  useEffect(() => {
    clearCart()
    refresh()
  }, [clearCart, refresh])

  const displayZone =
    order?.deliveryZoneLabel || order?.shippingState || "Other"

  return (
    <div className="min-h-[85vh] bg-white py-10 sm:py-14 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-7 text-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* Animated Celebratory Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 rounded-full flex items-center justify-center ring-8 ring-emerald-500/10 shadow-sm">
              <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-600 stroke-[2.2]" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md border border-emerald-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            Order Confirmed
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Thank You for Your Order! 🎉
          </h1>
          <p className="text-slate-600 max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
            We have received your order and sent a confirmation message with full tracking details to your email.
          </p>
        </div>

        {/* Order Details Card */}
        {order ? (
          <Card className="border border-slate-200/90 shadow-xl bg-white rounded-3xl overflow-hidden text-left">
            <CardContent className="p-5 sm:p-7 space-y-6">
              
              {/* Header Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                    Order Reference
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                    {order.orderNumber.startsWith("meeem") ? `#${order.orderNumber}` : `#ORD-${order.orderNumber}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 font-bold text-xs">
                    <CreditCard className="w-3 h-3 mr-1 text-emerald-600 inline" />
                    {order.paymentMethod === "COD" ? "Cash On Delivery" : order.paymentMethod}
                  </Badge>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                    Items Ordered ({order.items.length})
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Quantity & Price</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/80 transition-colors p-3 rounded-2xl text-xs sm:text-sm border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="h-7 w-7 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-800 truncate">
                          {item.productNameSnapshot || "Product Item"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-slate-700 font-bold">
                          {item.quantity} × {formatCurrency(item.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Charge Breakup (Clean Light/White theme) */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs text-slate-700 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-amber-600" />
                    Delivery Breakdown
                  </span>
                  <span className="text-[11px] text-emerald-900 font-bold bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    📍 {displayZone}
                  </span>
                </div>

                {(order.weightShippingFee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Weight-based Fee</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(order.weightShippingFee ?? 0)}
                    </span>
                  </div>
                )}

                {(order.dimensionShippingFee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dimension-based Fee</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(order.dimensionShippingFee ?? 0)}
                    </span>
                  </div>
                )}

                {(order.regionShippingFee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Regional Surcharge ({displayZone})
                    </span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(order.regionShippingFee ?? 0)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-slate-200/70 font-bold text-slate-900">
                  <span className="text-slate-700">Total Delivery Fee</span>
                  <span className="font-black text-amber-700 tabular-nums">
                    {(order.shipping ?? 0) <= 0 ? (
                      <span className="text-emerald-700">FREE</span>
                    ) : (
                      formatCurrency(order.shipping ?? 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Total & Delivery Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                {order.shippingAddressLine1 && (
                  <div className="space-y-1 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-amber-600" /> Delivery Address
                    </span>
                    <p className="text-xs font-bold text-slate-900">
                      {order.shippingFullName}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {order.shippingAddressLine1}
                      {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                      {order.shippingCity ? `, ${order.shippingCity}` : ""}
                      {order.shippingState ? `, ${order.shippingState}` : ""}
                    </p>
                    <p className="text-[11px] font-bold text-emerald-800 pt-0.5">
                      📍 {displayZone}
                    </p>
                  </div>
                )}

                <div className="space-y-1 p-3 rounded-2xl bg-amber-50/50 border border-amber-100 sm:text-right flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800/80 block">
                    Total Paid Amount
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 shadow-sm bg-white rounded-3xl p-8">
            <p className="text-slate-500 text-sm">Your order is being processed.</p>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto rounded-full font-bold shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 text-slate-900 px-8 h-12 gap-2 text-sm"
          >
            <Link href="/customer/orders">
              <Package className="w-4 h-4" />
              View My Orders
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-full font-bold px-8 h-12 gap-2 text-sm border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Link href="/">
              <Home className="w-4 h-4" />
              Continue Shopping
            </Link>
          </Button>
        </div>

      </div>
    </div>
  )
}
