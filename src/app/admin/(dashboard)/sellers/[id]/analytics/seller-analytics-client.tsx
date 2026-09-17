"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Card, CardContent } from "@/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Smartphone,
  Calendar,
  DollarSign,
  ShoppingCart,
  Package,
  Clock,
  TrendingUp,
  BarChart3,
  Layers,
  ReceiptText,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Ban,
  RefreshCw,
} from "lucide-react"
import type { SellerAnalyticsPayload } from "@/app/api/admin/sellers/[id]/analytics/route"
import {
  RevenueTrendChart,
  OrderStatusBreakdown,
  TopItemsBarChart,
} from "@/components/admin/sellers/analytics/seller-analytics-charts"
import { SellerAnalyticsCatalogTab } from "@/components/admin/sellers/analytics/seller-analytics-catalog-tab"
import { SellerAnalyticsOrdersTab } from "@/components/admin/sellers/analytics/seller-analytics-orders-tab"
import { SellerAnalyticsFinancialsTab } from "@/components/admin/sellers/analytics/seller-analytics-financials-tab"
import { SellerEmailModal, type SellerEmailTarget } from "@/components/admin/sellers/seller-email-modal"

interface SellerAnalyticsClientProps {
  id: string
  initialSellerType?: string
}

export function SellerAnalyticsClient({ id, initialSellerType }: SellerAnalyticsClientProps) {
  const router = useRouter()
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "1y" | "all">("30d")
  const [data, setData] = useState<SellerAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailModalTarget, setEmailModalTarget] = useState<SellerEmailTarget | null>(null)

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sellers/${id}/analytics?timeframe=${timeframe}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to load seller analytics")
      }
      setData(json)
    } catch (err: any) {
      setError(err?.message || "Failed to load seller analytics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchAnalytics()
    }
  }, [id, timeframe])

  if (loading && !data) {
    return <PageLoader message="Generating seller analytics report & performance graphs..." />
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="rounded-2xl gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
        <div className="p-8 bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-rose-800 dark:text-rose-200">Unable to load analytics</h2>
          <p className="text-xs text-rose-600 dark:text-rose-400">{error || "Seller profile not found."}</p>
          <Button onClick={fetchAnalytics} className="rounded-2xl gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Try Again
          </Button>
        </div>
      </div>
    )
  }

  const { seller, kpis, timeSeries, statusBreakdown, topItems, catalogItems, recentOrders } = data
  const isProduct = seller.sellerType === "PRODUCT"
  const isService = seller.sellerType === "SERVICE"
  const isHotel = seller.sellerType === "HOTEL"
  const isRestaurant = seller.sellerType === "RESTAURANT"

  const profileUrl = isHotel
    ? `/admin/hotel-sellers/${seller.id}`
    : isRestaurant
      ? `/admin/restaurant-sellers/${seller.id}`
      : `/admin/sellers/${seller.id}`

  const catalogPluralLabel = isProduct
    ? "Products"
    : isService
      ? "Services"
      : isHotel
        ? "Rooms & Properties"
        : "Food Menu"

  const timeframeLabels: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "1y": "Past Year",
    all: "All Time",
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="rounded-2xl h-10 w-10 border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 shadow-sm"
            title="Return to previous directory"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {seller.businessName}
              </h1>
              <Badge
                className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isProduct
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200"
                    : isService
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200"
                      : isHotel
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200"
                }`}
              >
                {isProduct
                  ? "🛍️ Product Seller"
                  : isService
                    ? "🛠️ Service Partner"
                    : isHotel
                      ? "🏨 Hotel Partner"
                      : "🍽️ Restaurant Partner"}
              </Badge>
              {seller.isApproved ? (
                <Badge className="bg-emerald-500 text-white rounded-full text-[10px] font-bold uppercase px-2.5 py-0.5">
                  Verified Partner
                </Badge>
              ) : (
                <Badge className="bg-amber-500 text-white rounded-full text-[10px] font-bold uppercase px-2.5 py-0.5">
                  Pending Review
                </Badge>
              )}
              {seller.isSuspended && (
                <Badge variant="destructive" className="rounded-full text-[10px] font-bold uppercase px-2.5 py-0.5 animate-pulse">
                  Suspended
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
              <span>Owner: <strong className="text-slate-800 dark:text-slate-200">{seller.ownerName}</strong></span>
              <span>•</span>
              {seller.email && (
                <span className="flex items-center gap-1 font-mono">
                  <Mail className="h-3 w-3 text-slate-400" /> {seller.email}
                </span>
              )}
              {seller.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3 w-3 text-slate-400" /> {seller.phone}
                </span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" /> Joined {new Date(seller.joinedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts & Timeframe Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Email / SMS Contact Shortcut */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEmailModalTarget({
                id: seller.id,
                name: seller.ownerName,
                businessName: seller.businessName,
                email: seller.email,
                phone: seller.phone,
                phoneCountryCode: seller.phoneCountryCode,
                sellerType: seller.sellerType,
              })
            }
            className="h-9 px-3 rounded-2xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 text-xs font-semibold gap-1.5 shadow-sm"
          >
            {seller.email ? <Mail className="h-3.5 w-3.5 text-indigo-600" /> : <Smartphone className="h-3.5 w-3.5 text-amber-600" />}
            <span>{seller.email ? "Email Partner" : "SMS Partner"}</span>
          </Button>

          {/* Profile Shortcut */}
          <Link
            href={profileUrl}
            className="h-9 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold gap-1.5 shadow-sm inline-flex items-center"
            title="View Full Profile / Manage"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Profile</span>
          </Link>

          {/* Timeframe Selector */}
          <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            {(["7d", "30d", "90d", "1y", "all"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-xl transition-all ${
                  timeframe === tf
                    ? "bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tf === "7d" ? "7D" : tf === "30d" ? "30D" : tf === "90d" ? "90D" : tf === "1y" ? "1Y" : "All"}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchAnalytics}
            disabled={loading}
            className="h-9 w-9 rounded-2xl text-slate-500 hover:bg-slate-100"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-violet-600" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── 4 Key Performance Indicator (KPI) Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Gross Revenue
              </span>
              <div className="h-8 w-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="pt-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono block">
                {formatCurrency(kpis.grossRevenue)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Over {timeframeLabels[timeframe]}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Orders / Bookings */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isHotel ? "Total Bookings" : "Total Orders"}
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </div>
            <div className="pt-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono block">
                {kpis.ordersCount}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                {kpis.completedOrdersCount} completed ({kpis.completionRate}%)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Catalog Items Uploaded */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {catalogPluralLabel}
              </span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="pt-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono block">
                {kpis.totalCatalogItems}
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                {kpis.activeCatalogItems} active & available
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Platform Commission Earned */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Platform Commission
              </span>
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 text-[10px] font-bold">
                {seller.commissionRate}%
              </Badge>
            </div>
            <div className="pt-2">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono block">
                {formatCurrency(kpis.commissionTotal)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Net: {formatCurrency(kpis.netEarnings)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabbed Navigation ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl h-11 border border-slate-200/80 dark:border-slate-800 max-w-full overflow-x-auto justify-start">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-violet-600 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Overview & Trends
          </TabsTrigger>

          <TabsTrigger
            value="catalog"
            className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
          >
            <Layers className="h-3.5 w-3.5" />
            {catalogPluralLabel} ({kpis.totalCatalogItems})
          </TabsTrigger>

          <TabsTrigger
            value="financials"
            className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Revenue & Commission
          </TabsTrigger>

          <TabsTrigger
            value="orders"
            className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            {isHotel ? "Bookings" : "Orders"} History ({kpis.ordersCount})
          </TabsTrigger>
        </TabsList>

        {/* ════════ TAB 1: OVERVIEW & TRENDS ════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Revenue Trend Chart */}
          <RevenueTrendChart
            data={timeSeries}
            timeframeLabel={timeframeLabels[timeframe]}
          />

          {/* 2-Column Row: Status Distribution & Top Items */}
          <div className="grid gap-6 md:grid-cols-2">
            <OrderStatusBreakdown
              breakdown={statusBreakdown}
              totalOrders={kpis.ordersCount}
            />
            <TopItemsBarChart
              items={topItems}
              sellerType={seller.sellerType}
            />
          </div>
        </TabsContent>

        {/* ════════ TAB 2: CATALOG OFFERINGS ════════ */}
        <TabsContent value="catalog" className="space-y-6">
          <SellerAnalyticsCatalogTab
            items={catalogItems}
            topItems={topItems}
            sellerType={seller.sellerType}
          />
        </TabsContent>

        {/* ════════ TAB 3: FINANCIALS ════════ */}
        <TabsContent value="financials" className="space-y-6">
          <SellerAnalyticsFinancialsTab data={data} />
        </TabsContent>

        {/* ════════ TAB 4: ORDERS & BOOKINGS ════════ */}
        <TabsContent value="orders" className="space-y-6">
          <SellerAnalyticsOrdersTab
            orders={recentOrders}
            sellerType={seller.sellerType}
          />
        </TabsContent>
      </Tabs>

      {/* Direct Email/SMS Modal */}
      <SellerEmailModal
        seller={emailModalTarget}
        open={!!emailModalTarget}
        onOpenChange={(val) => !val && setEmailModalTarget(null)}
      />
    </div>
  )
}
