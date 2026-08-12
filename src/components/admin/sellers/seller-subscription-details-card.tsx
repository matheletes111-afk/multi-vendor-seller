"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { CreditCard, Check, Sparkles, AlertCircle, Calendar, Layers, ShieldCheck, Box, ShoppingBag, Building2, Utensils } from "lucide-react"
import { cn } from "@/lib/utils"

interface SellerSubscriptionDetailsCardProps {
  subscription?: any
  plans?: any[]
  sellerType?: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | string
}

export function SellerSubscriptionDetailsCard({
  subscription,
  plans = [],
  sellerType = "PRODUCT"
}: SellerSubscriptionDetailsCardProps) {
  const activePlan = subscription?.plan
  const status = subscription?.status || "INACTIVE"

  const getLimitLabel = (p: any) => {
    if (sellerType === "HOTEL") {
      return p.maxRooms != null ? `${p.maxRooms} Rooms Max` : "Unlimited Rooms"
    }
    if (sellerType === "RESTAURANT") {
      return p.maxProducts != null ? `${p.maxProducts} Menu Items Max` : "Unlimited Menu Items"
    }
    if (sellerType === "SERVICE") {
      return p.maxProducts != null ? `${p.maxProducts} Services Max` : "Unlimited Services"
    }
    return p.maxProducts != null ? `${p.maxProducts} Products Max` : "Unlimited Products"
  }

  const getStatusBadge = (st: string) => {
    switch (st?.toUpperCase()) {
      case "ACTIVE":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
      case "TRIALING":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Trialing</Badge>
      case "CANCELED":
      case "EXPIRED":
        return <Badge variant="destructive">Expired / Canceled</Badge>
      default:
        return <Badge variant="outline" className="bg-slate-100 text-slate-700">No Active Plan</Badge>
    }
  }

  return (
    <Card className="border border-muted/50 shadow-xl bg-background rounded-3xl overflow-hidden flex flex-col border-l-4 border-l-purple-500/40">
      <CardHeader className="bg-muted/30 pb-4 border-b border-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <CreditCard className="h-4 w-4" /> Subscription Package Details
          </CardTitle>
          {getStatusBadge(status)}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6 flex-1">
        {/* CURRENT PLAN BOX */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-slate-500/5 border border-purple-500/15 relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block mb-1">
                Current Assigned Package
              </span>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {activePlan?.displayName || activePlan?.name || "Free Starter Package"}
                {activePlan?.price === 0 && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                    Default Starter
                  </Badge>
                )}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                {activePlan?.price === 0 ? "Free" : `$${activePlan?.price ?? 0}`}
              </span>
              {activePlan?.duration && (
                <span className="text-xs text-muted-foreground block">
                  / {activePlan.duration} Days
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-purple-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Upload Limit</span>
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                {activePlan ? getLimitLabel(activePlan) : "10 Products Max (Starter)"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Order Limit</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {activePlan?.maxOrders != null ? `${activePlan.maxOrders} Orders` : "Unlimited Orders"}
              </span>
            </div>

            {subscription?.currentPeriodEnd && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">Expires / Renews</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AVAILABLE PLANS LIST FOR THIS SELLER TYPE */}
        {plans.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-500" /> Available System Packages ({plans.length})
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const isSelected = activePlan?.id === p.id
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "p-3 rounded-2xl border transition-all text-left flex flex-col justify-between space-y-2",
                      isSelected
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm"
                        : "border-muted/60 bg-muted/20 hover:border-muted"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {p.displayName || p.name}
                        </span>
                        {isSelected && (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 h-4">Active</Badge>
                        )}
                      </div>
                      <span className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                        {p.price === 0 ? "Free" : `$${p.price}`}
                        <span className="text-[10px] font-normal text-muted-foreground"> / {p.duration || 30}d</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-muted/40">
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="truncate">{getLimitLabel(p)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{p.maxOrders != null ? `${p.maxOrders} orders` : "Unlimited orders"}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
