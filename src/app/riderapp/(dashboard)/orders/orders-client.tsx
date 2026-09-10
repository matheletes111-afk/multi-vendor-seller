"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  Bike,
  ArrowRight,
  Phone,
  Store,
  Navigation,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  X,
  Calendar,
  CreditCard,
  Banknote,
  ArrowUpDown,
  DollarSign,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { cn, formatCurrency } from "@/lib/utils"

export function RiderOrdersClient() {
  const [tab, setTab] = useState<"active" | "offered" | "completed" | "cancelled" | "all">("active")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [periodFilter, setPeriodFilter] = useState<string>("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("ALL")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showFilters, setShowFilters] = useState<boolean>(false)

  const [assignments, setAssignments] = useState<any[]>([])
  const [counts, setCounts] = useState<{
    all: number
    active: number
    offered: number
    completed: number
    cancelled: number
  }>({
    all: 0,
    active: 0,
    offered: 0,
    completed: 0,
    cancelled: 0,
  })
  const [totalEarnings, setTotalEarnings] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set("tab", tab)
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter)
      if (periodFilter && periodFilter !== "all") params.set("period", periodFilter)
      if (paymentMethodFilter && paymentMethodFilter !== "ALL") params.set("paymentMethod", paymentMethodFilter)
      if (sortBy && sortBy !== "newest") params.set("sortBy", sortBy)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())

      const res = await fetch(`/api/riderapp/orders?${params.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setAssignments(data.assignments || [])
        if (data.counts) setCounts(data.counts)
        if (typeof data.totalEarnings === "number") setTotalEarnings(data.totalEarnings)
      } else {
        setError(data.error || "Failed to load orders")
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading orders")
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, periodFilter, paymentMethodFilter, sortBy, searchQuery])

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrders()
    }, 250)
    return () => clearTimeout(handler)
  }, [fetchOrders])

  // Auto-refresh offers and active orders every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === "active" || tab === "offered") {
        fetchOrders()
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [fetchOrders, tab])

  const handleAccept = async (assignmentId: string) => {
    try {
      setActionLoading(assignmentId)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}/accept`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setTab("active")
        fetchOrders()
      } else {
        alert(data.error || "Failed to accept assignment")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to decline this delivery offer?")) return
    try {
      setActionLoading(assignmentId)
      const res = await fetch(`/api/riderapp/orders/${assignmentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Declined by rider" }),
      })
      if (res.ok) {
        fetchOrders()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to decline")
      }
    } catch (err: any) {
      alert(err?.message || "Network error")
    } finally {
      setActionLoading(null)
    }
  }

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    periodFilter !== "all" ||
    paymentMethodFilter !== "ALL" ||
    sortBy !== "newest" ||
    searchQuery.trim().length > 0

  const clearAllFilters = () => {
    setStatusFilter("ALL")
    setPeriodFilter("all")
    setPaymentMethodFilter("ALL")
    setSortBy("newest")
    setSearchQuery("")
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Package className="w-7 h-7 text-blue-600" />
            Delivery Orders
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your active pickups, incoming delivery offers, search &amp; filter delivery history.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders()}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-xl text-xs gap-1.5 h-9 font-semibold"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters {hasActiveFilters && "(Active)"}
          </Button>

          <Link href="/riderapp/settings">
            <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1.5 h-9">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Delivery Zones
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs with Dynamic Real-time Counters */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {[
          { id: "active", label: "Active Deliveries", count: counts.active },
          { id: "offered", label: "New Offers", count: counts.offered },
          { id: "completed", label: "Completed", count: counts.completed },
          { id: "cancelled", label: "Declined / Cancelled", count: counts.cancelled },
          { id: "all", label: "All History", count: counts.all },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as any)
              setStatusFilter("ALL")
            }}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2",
              tab === t.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-black",
                tab === t.id
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        {/* Main Search and Quick Action */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, store, customer, phone, address, or OTP..."
              className="h-10 pl-9 pr-8 text-xs rounded-xl bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-muted/30 border rounded-xl px-2.5 h-10 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort orders"
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer text-foreground"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="earning_desc">Highest Earning</option>
                <option value="distance_asc">Shortest Distance</option>
                <option value="distance_desc">Longest Distance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Detailed Filters Drawer / Bar */}
        {showFilters && (
          <div className="pt-3 border-t border-border/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Specific Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Detailed Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="ALL">All Statuses in {tab}</option>
                <option value="OFFERED">OFFERED (Waiting for you)</option>
                <option value="ACCEPTED">ACCEPTED (Head to store)</option>
                <option value="AT_PICKUP">AT PICKUP (At seller shop)</option>
                <option value="PICKED_UP">PICKED UP (In transit)</option>
                <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY (Near customer)</option>
                <option value="DELIVERED">DELIVERED (Completed)</option>
                <option value="REJECTED">REJECTED (Declined)</option>
                <option value="TIMED_OUT">TIMED OUT (Offer expired)</option>
                <option value="CANCELLED_BY_RIDER">CANCELLED BY RIDER</option>
              </select>
            </div>

            {/* Date Period */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Date Offered / Completed</label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Payment Method</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="ALL">All Payment Types</option>
                <option value="COD">Cash on Delivery (Collect Cash)</option>
                <option value="PREPAID">Prepaid / Online (Do not collect cash)</option>
              </select>
            </div>

            {/* Clear Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="w-full h-9 rounded-xl text-xs gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Reset All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
            <span className="text-muted-foreground font-medium mr-1">Active Filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 rounded-lg px-2 py-0.5">
                Query: &quot;{searchQuery}&quot;
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {statusFilter !== "ALL" && (
              <Badge variant="secondary" className="gap-1 rounded-lg px-2 py-0.5">
                Status: {statusFilter.replace(/_/g, " ")}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter("ALL")} />
              </Badge>
            )}
            {periodFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 rounded-lg px-2 py-0.5 capitalize">
                Period: {periodFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setPeriodFilter("all")} />
              </Badge>
            )}
            {paymentMethodFilter !== "ALL" && (
              <Badge variant="secondary" className="gap-1 rounded-lg px-2 py-0.5">
                Payment: {paymentMethodFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setPaymentMethodFilter("ALL")} />
              </Badge>
            )}
            {sortBy !== "newest" && (
              <Badge variant="secondary" className="gap-1 rounded-lg px-2 py-0.5">
                Sorted: {sortBy.replace(/_/g, " ")}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSortBy("newest")} />
              </Badge>
            )}
            <button
              onClick={clearAllFilters}
              className="text-blue-600 hover:underline font-bold text-[11px] ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Orders Count & Total Earnings Summary Bar */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="font-bold text-foreground">
          Showing {assignments.length} {assignments.length === 1 ? "delivery" : "deliveries"}
        </span>
        {totalEarnings > 0 && (
          <span className="text-muted-foreground">
            Total delivery charges:{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalEarnings)}
            </span>
          </span>
        )}
      </div>

      {/* Content Area - Full width responsive grid */}
      {loading && assignments.length === 0 ? (
        <div className="p-16 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          Loading delivery assignments...
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600">
          {error}
        </div>
      ) : assignments.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-card border-border/80 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
            <Bike className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              {hasActiveFilters
                ? "No Deliveries Matched Your Filter"
                : tab === "offered"
                ? "No New Delivery Offers"
                : tab === "active"
                ? "No Active Deliveries Right Now"
                : "No Orders Found"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {hasActiveFilters
                ? "Try adjusting your search criteria or resetting filters to see more orders."
                : tab === "offered"
                ? "When stores in your zone request product deliveries, high-priority offers will appear here."
                : tab === "active"
                ? "You currently have no ongoing deliveries. Check 'New Offers' or keep your GPS active to receive orders."
                : "Completed and archived deliveries will be listed here."}
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="rounded-xl text-xs font-semibold"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assignments.map((assignment) => {
            const order = assignment.order
            const shopName =
              order?.seller?.store?.name ||
              order?.seller?.businessInfo?.businessName ||
              "Seller Store"
            const shopPhone =
              order?.seller?.user?.phone ||
              order?.seller?.businessInfo?.pocContact ||
              ""
            const customerName =
              order?.shippingFullName || order?.customer?.name || "Customer"
            const customerPhone =
              order?.shippingPhone || order?.customer?.phone || ""
            const dropAddress = [
              order?.shippingAddressLine1,
              order?.shippingCity,
            ]
              .filter(Boolean)
              .join(", ")

            const isOffered = assignment.status === "OFFERED"
            const isDelivered = assignment.status === "DELIVERED"
            const isCod = (order?.paymentMethod || "").toUpperCase() === "COD"

            return (
              <div
                key={assignment.id}
                className={cn(
                  "p-5 rounded-3xl border bg-card transition-all space-y-4 shadow-xs flex flex-col justify-between",
                  isOffered
                    ? "border-amber-400 dark:border-amber-600/60 ring-2 ring-amber-400/20 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-border/80"
                )}
              >
                <div className="space-y-3.5">
                  {/* Top Badge & Order Ref */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        #{order?.orderNumber || assignment.orderId.slice(-6)}
                      </span>
                      {assignment.distanceKm && (
                        <Badge variant="outline" className="text-[10px] rounded-lg font-medium">
                          {assignment.distanceKm} km
                        </Badge>
                      )}
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                        isOffered
                          ? "bg-amber-500 text-white"
                          : assignment.status === "DELIVERED"
                          ? "bg-green-600 text-white"
                          : "bg-blue-600 text-white"
                      )}
                    >
                      {assignment.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {/* Payment Method Badge */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {isCod ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                        <Banknote className="w-3 h-3" />
                        COD: Collect {formatCurrency(Number(order?.totalAmount || 0))}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
                        <CreditCard className="w-3 h-3" />
                        Prepaid (Do not collect cash)
                      </span>
                    )}

                    {assignment.deliveryOtp && (
                      <span className="font-mono text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 ml-auto">
                        OTP: {assignment.deliveryOtp}
                      </span>
                    )}
                  </div>

                  {/* Pickup & Drop Points */}
                  <div className="space-y-2.5 text-xs">
                    {/* Store Pickup */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {shopName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Pickup Store {shopPhone ? `• ${shopPhone}` : ""}
                        </div>
                      </div>
                      {shopPhone && (
                        <a
                          href={`tel:${shopPhone}`}
                          className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 shrink-0"
                          title="Call Store"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Customer Drop */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {customerName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {dropAddress || "Delivery Address"}
                        </div>
                      </div>
                      {customerPhone && (
                        <a
                          href={`tel:${customerPhone}`}
                          className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 shrink-0"
                          title="Call Customer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Items preview & Delivery Earning */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {order?.items?.length || 1} item{(order?.items?.length || 1) > 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Earning:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(Number((assignment as any).earningForThisDelivery || order?.items?.reduce((s: number, i: any) => s + (i.shippingAmount || 0), 0) || order?.shipping || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2">
                  {isOffered ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(assignment.id)}
                        disabled={actionLoading === assignment.id}
                        className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Accept Offer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(assignment.id)}
                        disabled={actionLoading === assignment.id}
                        className="rounded-xl text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <Link href={`/riderapp/orders/${assignment.id}`} className="block">
                      <Button
                        size="sm"
                        className="w-full rounded-xl text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isDelivered ? "View Summary" : "Open Live Delivery"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
