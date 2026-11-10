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
  Banknote,
  Send,
  Loader2,
  FileText,
  CreditCard,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"

export function RiderRevenueClient() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "delivered" | "inprogress">("all")
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewTab, setViewTab] = useState<"deliveries" | "ledger">("deliveries")

  // Payout Request Modal State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [payoutNote, setPayoutNote] = useState("")
  const [submittingPayout, setSubmittingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null)

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

  const handleRequestPayout = async () => {
    setSubmittingPayout(true)
    setPayoutError(null)
    setPayoutSuccess(null)

    try {
      const res = await fetch("/api/riderapp/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerNote: payoutNote }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setPayoutSuccess("Payout request submitted successfully! Admin will disburse your earnings shortly.")
        setTimeout(() => {
          setIsPayoutModalOpen(false)
          setPayoutSuccess(null)
          setPayoutNote("")
          fetchRevenue()
        }, 1500)
      } else {
        setPayoutError(json.error || "Failed to submit payout request")
      }
    } catch (err: any) {
      setPayoutError(err.message || "Failed to submit payout request")
    } finally {
      setSubmittingPayout(false)
    }
  }

  const summary = data?.summary || {
    netBalance: 0,
    availablePayoutBalance: 0,
    totalDeliveredRevenue: 0,
    prepaidDeliveredRevenue: 0,
    codDeliveredRevenue: 0,
    codCashCollectedTotal: 0,
    pendingInProgressRevenue: 0,
    deliveredCount: 0,
    inProgressCount: 0,
    totalDeliveriesCount: 0,
    currency: "NLe",
    hasPendingPayoutRequest: false,
    pendingPayoutRequest: null,
  }

  const deliveries: any[] = data?.deliveries || []
  const recentTransactions: any[] = data?.recentTransactions || []
  const riderBankDetails = data?.riderBankDetails || {}

  const canRequestPayout = summary.availablePayoutBalance > 0 && !summary.hasPendingPayoutRequest

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 bg-blue-700 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white rounded-3xl shadow-md relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1d4ed8 0%, #4338ca 50%, #6d28d9 100%)",
        }}
      >
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white border border-white/30 shadow-xs mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Rider Earnings &amp; Settlements</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-xs">
            My Revenue &amp; Ledger
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed max-w-xl">
            Track prepaid online payouts (AfriMoney), cash on delivery (COD) doorstep collections, and request earnings disbursement.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRevenue()}
            disabled={loading}
            className="rounded-xl text-xs font-semibold gap-1.5 bg-white/15 hover:bg-white/25 text-white border-white/30 shadow-xs backdrop-blur-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Link href="/riderapp/orders">
            <Button
              size="sm"
              className="rounded-xl text-xs gap-1.5 bg-white text-blue-900 hover:bg-blue-50 font-bold shadow-md hover:shadow-lg transition-all"
            >
              <Truck className="w-3.5 h-3.5 text-blue-700" />
              Delivery Queue
            </Button>
          </Link>
        </div>

        {/* Ambient decorative blur */}
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Main Wallet & Settlement Card */}
      <div className="p-6 rounded-3xl bg-card border shadow-sm relative overflow-hidden bg-gradient-to-br from-card via-card to-blue-50/20 dark:to-blue-950/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-sm">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Available AfriMoney Payout Balance
                </h2>
                <p className="text-xs text-muted-foreground">
                  Funds collected online by platform for completed prepaid deliveries, ready for payout.
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-foreground tabular-nums">
                {formatCurrency(Number(summary.availablePayoutBalance || 0))}
              </span>
              {summary.hasPendingPayoutRequest ? (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 font-bold text-xs gap-1 py-1 px-3">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Payout Request Pending (SLE {summary.pendingPayoutRequest?.requestedAmount?.toFixed(2)})
                </Badge>
              ) : summary.availablePayoutBalance > 0 ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 font-bold text-xs gap-1 py-1 px-3">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Payout Available
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-semibold py-1 px-3 text-muted-foreground">
                  No Pending Payout
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>Payout Method on File:</span>
              <span className="font-semibold text-foreground">
                {riderBankDetails.paymentOption || "AfriMoney"} • {riderBankDetails.accountNumber || riderBankDetails.mobileNumber || "Details in settings"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 lg:self-center shrink-0">
            <Button
              onClick={() => setIsPayoutModalOpen(true)}
              disabled={!canRequestPayout}
              className="rounded-2xl h-11 px-6 font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg disabled:opacity-50"
            >
              <Banknote className="w-4 h-4" />
              {summary.hasPendingPayoutRequest ? "Payout Pending Admin" : "Request Payout"}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              {summary.hasPendingPayoutRequest
                ? "Admin is processing your disbursement."
                : summary.availablePayoutBalance <= 0
                ? "Deliver prepaid orders to accumulate balance."
                : "Disbursed via AfriMoney or Bank."}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards - Breakdown of AfriMoney vs COD vs In-Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Lifetime Realized Revenue */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/10 border border-emerald-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Delivered Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
            {formatCurrency(Number(summary.totalDeliveredRevenue || 0))}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {summary.deliveredCount || 0} completed deliveries
          </p>
        </div>

        {/* Prepaid AfriMoney Deliveries Revenue */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-blue-500/10 border border-sky-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
            <span className="text-xs font-bold uppercase tracking-wider">AfriMoney (Prepaid) Earned</span>
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
            {formatCurrency(Number(summary.prepaidDeliveredRevenue || 0))}
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
            Online customer payments held by platform
          </p>
        </div>

        {/* COD Cash Delivery Earnings */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-orange-500/10 border border-amber-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">COD Fees (Cash in Hand)</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
            {formatCurrency(Number(summary.codDeliveredRevenue || 0))}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold truncate">
            Doorstep total collected: {formatCurrency(Number(summary.codCashCollectedTotal || 0))}
          </p>
        </div>

        {/* In-Progress Potential Earnings */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-violet-500/10 border border-indigo-500/25 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-xs font-bold uppercase tracking-wider">In-Progress Delivery Fees</span>
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
            {formatCurrency(Number(summary.pendingInProgressRevenue || 0))}
          </div>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            {summary.inProgressCount || 0} active in-transit tasks
          </p>
        </div>
      </div>

      {/* View Tabs & Search Bar */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main View Switcher: Deliveries vs Ledger */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit">
            <button
              onClick={() => setViewTab("deliveries")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all gap-1.5 flex items-center",
                viewTab === "deliveries"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              Delivery Orders ({deliveries.length})
            </button>
            <button
              onClick={() => setViewTab("ledger")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all gap-1.5 flex items-center",
                viewTab === "ledger"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Balance Ledger ({recentTransactions.length})
            </button>
          </div>

          {/* Period Dropdown & Search (Only shown in deliveries tab) */}
          {viewTab === "deliveries" && (
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
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order #, store, customer..."
                  className="h-9 pl-8 text-xs rounded-xl bg-background"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB CONTENT: DELIVERIES */}
      {viewTab === "deliveries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Delivery Revenue Breakdown (AfriMoney &amp; COD)
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
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
                  Accept and fulfill delivery orders to start generating revenue.
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
                const isPrepaid = delivery.paymentMethod === "AFRIMONEY"
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
                        ? isPrepaid
                          ? "border-sky-200 dark:border-sky-950/60 bg-gradient-to-r from-card via-card to-sky-500/5"
                          : "border-amber-200 dark:border-amber-950/60 bg-gradient-to-r from-card via-card to-amber-500/5"
                        : "border-blue-200 dark:border-blue-950/60 bg-gradient-to-r from-card via-card to-blue-500/5"
                    )}
                  >
                    {/* Top Row: Order Number, Payment Method & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">
                          #{delivery.orderNumber}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          • {formattedDate}
                        </span>

                        {/* Payment Method Badge */}
                        {isPrepaid ? (
                          <Badge className="bg-sky-50 text-sky-700 border-sky-200 font-bold text-[10px] gap-1">
                            <CreditCard className="w-3 h-3" /> AfriMoney (Prepaid)
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] gap-1">
                            <Banknote className="w-3 h-3" /> Cash on Delivery (COD)
                          </Badge>
                        )}

                        {/* Settlement Status Badge */}
                        {isDelivered && (
                          delivery.settlementStatus === "PAID_OUT" ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Disbursed (Paid Out)
                            </Badge>
                          ) : delivery.settlementStatus === "YET_TO_PAY" ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px] gap-1">
                              <Clock className="w-3 h-3" /> Payout Pending
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-50 text-slate-700 border-slate-200 font-bold text-[10px] gap-1">
                              <Wallet className="w-3 h-3" /> Cash in Hand
                            </Badge>
                          )
                        )}

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
                              <Clock className="w-3 h-3" /> In Progress
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

                      {/* Items & COD Notes */}
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>Items in package ({delivery.totalItemsCount})</span>
                          <span>Delivery Fee</span>
                        </div>
                        <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                          {delivery.items.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
                                <span className="font-bold text-foreground">{item.quantity}x</span>
                                <span className="truncate text-foreground font-medium">{item.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                                {formatCurrency(Number(item.shippingAmount || 0))}
                              </span>
                            </div>
                          ))}
                        </div>

                        {!isPrepaid && delivery.codAmountCollected && (
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <span>Cash Collected at Doorstep:</span>
                            <span className="font-bold font-mono">{formatCurrency(Number(delivery.codAmountCollected))}</span>
                          </div>
                        )}
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
                          {isDelivered ? "Your Net Earning:" : "Pending Delivery Fee:"}
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
      )}

      {/* TAB CONTENT: LEDGER & BALANCE TRANSACTIONS */}
      {viewTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Rider Financial Ledger &amp; Balance History
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              Showing recent {recentTransactions.length} transaction records
            </span>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-card border-border/80 space-y-3">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No Ledger Transactions Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Completed deliveries and payout disbursements will create chronological ledger entries here.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reason / Activity</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Reference &amp; Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentTransactions.map((tx) => {
                      const isCredit = tx.kind === "CREDIT"
                      return (
                        <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono">
                            {new Date(tx.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              className={cn(
                                "font-bold text-[10px]",
                                isCredit
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {tx.kind}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                            {tx.reason.replace(/_/g, " ")}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-sm">
                            <span className={isCredit ? "text-emerald-600" : "text-rose-600"}>
                              {isCredit ? "+" : "-"} {formatCurrency(Number(tx.amount))}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                            {tx.note || "No note recorded"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUEST PAYOUT DIALOG */}
      <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Banknote className="w-5 h-5 text-blue-600" />
              Request Delivery Payout
            </DialogTitle>
            <DialogDescription className="text-xs">
              Request immediate disbursement of your accumulated prepaid AfriMoney delivery fees.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-muted/40 border space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Disbursement Amount
              </span>
              <div className="text-3xl font-black text-foreground">
                {formatCurrency(Number(summary.availablePayoutBalance || 0))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Net balance for verified prepaid deliveries.
              </p>
            </div>

            <div className="p-4 rounded-2xl border space-y-2 text-xs">
              <span className="font-bold text-foreground block">
                Destination Payout Account:
              </span>
              <div className="space-y-1 text-muted-foreground">
                <div>Method: <strong className="text-foreground">{riderBankDetails.paymentOption || "AfriMoney"}</strong></div>
                {riderBankDetails.bankName && <div>Bank: <strong className="text-foreground">{riderBankDetails.bankName}</strong></div>}
                {riderBankDetails.accountHolderName && <div>Holder: <strong className="text-foreground">{riderBankDetails.accountHolderName}</strong></div>}
                {riderBankDetails.accountNumber && <div>Account: <strong className="text-foreground">{riderBankDetails.accountNumber}</strong></div>}
                {riderBankDetails.mobileNumber && <div>Mobile Wallet: <strong className="text-foreground">{riderBankDetails.mobileNumber}</strong></div>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Note to Admin (Optional):
              </label>
              <Textarea
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder="e.g. Please disburse via AfriMoney to registered number."
                className="rounded-xl text-xs resize-none"
                rows={2}
              />
            </div>

            {payoutError && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {payoutError}
              </div>
            )}

            {payoutSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {payoutSuccess}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsPayoutModalOpen(false)}
              disabled={submittingPayout}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayout}
              disabled={submittingPayout || !!payoutSuccess}
              className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {submittingPayout ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
