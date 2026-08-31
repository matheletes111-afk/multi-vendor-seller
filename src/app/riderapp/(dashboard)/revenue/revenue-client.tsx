"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Wallet,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Store,
  MapPin,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Truck,
  DollarSign,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { cn, formatCurrency } from "@/lib/utils"

export function RiderRevenueClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "delivered" | "inprogress">("all")
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchRevenue = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("status", statusFilter)
      params.set("period", periodFilter)
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim())
      }

      const res = await fetch(`/api/riderapp/revenue?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error("Failed to fetch rider revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRevenue()
    }, 250)
    return () => clearTimeout(handler)
  }, [statusFilter, periodFilter, searchQuery])

  const summary = data?.summary || {
    totalDeliveredRevenue: 0,
    pendingInProgressRevenue: 0,
    deliveredCount: 0,
    inProgressCount: 0,
    totalDeliveriesCount: 0,
    currency: "NLe",
  }

  const deliveries: any[] = data?.deliveries || []

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 bg-linear-to-r from-blue-700 via-indigo-700 to-violet-800 text-white rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-1 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-semibold text-blue-100 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Rider Earnings & Settlements
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            My Revenue
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
            Track your delivery charges, order item allocations, and confirmed earnings upon completed deliveries.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRevenue()}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Link href="/riderapp/orders">
            <Button
              size="sm"
              className="rounded-xl text-xs gap-1.5 bg-white text-blue-800 hover:bg-white/90 font-bold shadow-sm"
            >
              <Truck className="w-3.5 h-3.5" />
              Delivery Queue
            </Button>
          </Link>
        </div>

        {/* Decorative ambient background blur */}
        <div className="absolute -right-8 -bottom-8 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Delivered Realized Earnings */}
        <div className="p-5 rounded-2xl bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Delivered Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground">
            {formatCurrency(Number(summary.totalDeliveredRevenue || 0))}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {summary.deliveredCount || 0} completed &amp; settled deliveries
          </p>
        </div>

        {/* In-Progress Potential Earnings */}
        <div className="p-5 rounded-2xl bg-linear-to-br from-blue-500/10 via-blue-500/5 to-indigo-500/10 border border-blue-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-xs font-bold uppercase tracking-wider">In-Progress Delivery Fees</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground">
            {formatCurrency(Number(summary.pendingInProgressRevenue || 0))}
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            {summary.inProgressCount || 0} active in-transit tasks
          </p>
        </div>

        {/* Completed Deliveries Count */}
        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Completed Deliveries</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {summary.deliveredCount || 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Delivered with verified OTP &amp; photo proof
          </p>
        </div>

        {/* Ongoing Deliveries Count */}
        <div className="p-5 rounded-2xl bg-card border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">In-Transit Drops</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {summary.inProgressCount || 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Settles immediately upon customer delivery
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all", label: `All Deliveries (${summary.totalDeliveriesCount || 0})` },
              { id: "delivered", label: `Delivered (${summary.deliveredCount || 0})` },
              { id: "inprogress", label: `In Progress (${summary.inProgressCount || 0})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setStatusFilter(t.id as any)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                  statusFilter === t.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Period Dropdown & Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Period Selector */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
              {[
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "week", label: "Week" },
                { id: "month", label: "Month" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodFilter(p.id as any)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px]",
                    periodFilter === p.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, store, customer..."
                className="h-9 pl-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Orders List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Revenue Breakdown by Order &amp; Package
          </h2>
          <span className="text-xs text-muted-foreground">
            Showing {deliveries.length} {deliveries.length === 1 ? "record" : "records"}
          </span>
        </div>

        {loading && deliveries.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            Loading revenue data...
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-card border-border/80 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
              <Wallet className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                No Revenue Records Found
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {statusFilter === "delivered"
                  ? "No completed deliveries found for the selected period."
                  : statusFilter === "inprogress"
                  ? "You have no active in-progress deliveries right now."
                  : "Accept and fulfill delivery orders to start generating revenue."}
              </p>
            </div>
            <Link href="/riderapp/orders">
              <Button size="sm" className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold">
                View Available Orders
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery) => {
              const isDelivered = delivery.isDelivered
              const formattedDate = delivery.deliveredAt
                ? new Date(delivery.deliveredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date(delivery.offeredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })

              return (
                <div
                  key={delivery.id}
                  className={cn(
                    "p-5 rounded-3xl border bg-card transition-all space-y-4 shadow-xs",
                    isDelivered
                      ? "border-emerald-200 dark:border-emerald-950/60 bg-linear-to-r from-card via-card to-emerald-500/5"
                      : "border-blue-200 dark:border-blue-950/60 bg-linear-to-r from-card via-card to-blue-500/5"
                  )}
                >
                  {/* Top Row: Order Number, Date & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">
                        #{delivery.orderNumber}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        • {formattedDate}
                      </span>
                      {delivery.distanceKm && (
                        <Badge variant="outline" className="text-[10px] rounded-lg">
                          {delivery.distanceKm} km trip
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize",
                          isDelivered
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white"
                        )}
                      >
                        {isDelivered ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> In Progress ({delivery.status.replace(/_/g, " ")})
                          </span>
                        )}
                      </Badge>

                      <Link href={`/riderapp/orders/${delivery.assignmentId}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          View Order <ChevronRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Middle Section: Route & Order Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Locations */}
                    <div className="space-y-2">
                      {/* Store */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Store className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground truncate">
                            {delivery.store?.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {delivery.store?.address || "Store pickup address"}
                          </div>
                        </div>
                      </div>

                      {/* Customer */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground truncate">
                            {delivery.customer?.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {delivery.customer?.dropAddress || "Customer delivery address"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Items List */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                        <span>Items in this package ({delivery.totalItemsCount})</span>
                        <span>Item Delivery Charge</span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {delivery.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-xs gap-2">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                              <span className="font-bold text-foreground">{item.quantity}x</span>
                              <span className="truncate text-foreground font-medium">{item.name}</span>
                              {item.variantName && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  ({item.variantName})
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                              {formatCurrency(Number(item.shippingAmount || 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Delivery Charge & Realized Total Amount */}
                  <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10 -mx-5 -mb-5 px-5 py-3 rounded-b-3xl">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Delivery Charge:</span>
                        <span className="font-bold text-foreground text-sm">
                          {formatCurrency(Number(delivery.deliveryCharge || 0))}
                        </span>
                      </div>

                      {delivery.deliveryProofImage && (
                        <div className="border-l border-border pl-3">
                          <span className="text-muted-foreground block text-[11px]">Proof:</span>
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> OTP &amp; Photo Verified
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Total Realized Amount */}
                    <div className="flex items-center sm:justify-end gap-2 text-right">
                      <span className="text-xs text-muted-foreground font-medium">
                        {isDelivered ? "Total Earned Amount:" : "Total Amount:"}
                      </span>
                      {isDelivered ? (
                        <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-base sm:text-lg">
                          {formatCurrency(Number(delivery.totalAmount || 0))}
                        </div>
                      ) : (
                        <div className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Pending (Upon Delivery)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
