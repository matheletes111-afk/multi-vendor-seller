"use client"

import Link from "next/link"
import { CheckCircle2, ShoppingBag, ArrowRight, Package, Truck, ShieldCheck, Home } from "lucide-react"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"

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
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 text-center animate-in fade-in zoom-in duration-500">
        
        {/* Animated Success Badge */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse ring-8 ring-emerald-500/5">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 stroke-[2.5]" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1.5 shadow-lg border border-emerald-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Order Placed Successfully! 🎉
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base leading-relaxed">
            Thank you for your purchase! We have received your order and sent a confirmation message to your email.
          </p>
        </div>

        {/* Order Details Card */}
        {order ? (
          <Card className="border-none shadow-2xl bg-gradient-to-br from-background via-background to-muted/20 rounded-3xl overflow-hidden text-left">
            <CardContent className="p-6 sm:p-8 space-y-6">
              
              {/* Header Meta */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border/50">
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-muted-foreground block">
                    Order Reference
                  </span>
                  <span className="text-xl font-black font-mono text-primary">
                    {order.orderNumber.startsWith("meeem") ? `#${order.orderNumber}` : `#ORD-${order.orderNumber}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-3 py-1 font-bold text-xs uppercase tracking-wider">
                    {order.paymentMethod === "COD" ? "Cash On Delivery" : order.paymentMethod}
                  </Badge>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-3">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">
                  Items Ordered ({order.items.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-muted/40 p-3 rounded-2xl text-xs sm:text-sm">
                      <span className="font-semibold text-foreground truncate max-w-[280px]">
                        {item.productNameSnapshot || "Product"}
                      </span>
                      <span className="text-muted-foreground font-mono shrink-0 ml-2">
                        {item.quantity} x {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Fee Breakup */}
              <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2.5 text-xs border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Delivery Charge Breakup</span>
                  <span className="text-[10px] text-slate-400 font-medium">Region: {order.shippingState || "Other"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Weight Charge</span>
                  <span className="font-bold tabular-nums text-slate-200">{formatCurrency(order.weightShippingFee ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimension Charge</span>
                  <span className="font-bold tabular-nums text-slate-200">{formatCurrency(order.dimensionShippingFee ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Region Fee</span>
                  <span className="font-bold tabular-nums text-slate-200">{formatCurrency(order.regionShippingFee ?? 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-black">
                  <span className="text-orange-400 uppercase tracking-wider text-[10px]">Total Shipping Fee</span>
                  <span className="text-orange-400 tabular-nums">{formatCurrency(order.shipping ?? 0)}</span>
                </div>
              </div>

              {/* Total & Delivery Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                {order.shippingAddressLine1 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                      <Truck className="w-3 h-3 text-primary" /> Delivery Destination
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {order.shippingFullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {order.shippingAddressLine1}, {order.shippingCity}
                    </p>
                  </div>
                )}

                <div className="space-y-1 sm:text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Total Paid Amount
                  </span>
                  <p className="text-2xl font-black text-foreground tabular-nums">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-xl bg-background rounded-3xl p-8">
            <p className="text-muted-foreground text-sm">Your order is being processed.</p>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button asChild size="lg" className="w-full sm:w-auto rounded-full font-bold shadow-xl shadow-primary/20 px-8 h-12 gap-2 text-sm">
            <Link href="/my-orders">
              <Package className="w-4 h-4" />
              View My Orders
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full font-bold px-8 h-12 gap-2 text-sm border-muted-foreground/20">
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
