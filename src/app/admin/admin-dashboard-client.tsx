"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, cn } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { MonthlyBarChart, type MonthlyAnalyticItem } from "@/components/admin/dashboard/monthly-bar-chart"
import { AddSellerModal } from "@/components/admin/sellers/add-seller-modal"
import {
  Users,
  Package,
  Wrench,
  UtensilsCrossed,
  Utensils,
  Building2,
  Bike,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  ArrowRight,
  CreditCard,
  BadgeDollarSign,
  TrendingUp,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  Radio,
  Layers,
} from "lucide-react"

export type AdminDashboardOverview = {
  // Legacy / Basic
  totalSellers: number
  totalCustomers: number
  totalProducts: number
  activeProducts: number
  totalServices: number
  activeServices: number
  totalOrders: number
  totalFoodOrders: number
  totalHotelBookings: number
  totalTransactions: number
  totalRevenue: number
  subscriptionRevenue: number
  adRevenue: number
  commissionRevenue: number
  totalOrderVolume: number
  totalFoodOrderVolume: number
  totalHotelBookingVolume: number
  grossMerchandiseValue: number
  pendingSellers: number
  totalHotels: number
  activeHotels: number
  totalHotelSellers: number
  totalRestaurantSellers: number
  pendingHotelSellers: number
  pendingRestaurantSellers: number

  // Granular counts
  totalAllSellers: number
  totalProductSellers: number
  totalServiceSellers: number
  pendingProductSellers: number
  pendingServiceSellers: number
  totalPendingSellers: number

  totalFoods: number
  activeFoods: number

  totalRiders: number
  approvedRiders: number
  pendingRiders: number

  // Monthly Analytics
  monthlyAnalytics: MonthlyAnalyticItem[]
}

export function AdminDashboardClient() {
  const [data, setData] = useState<AdminDashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddSellerOpen, setIsAddSellerOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch admin overview statistics")
      const json = (await res.json()) as AdminDashboardOverview
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to fetch overview")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(true)
      }
    }, 45000)

    return () => window.clearInterval(intervalId)
  }, [loadData])

  if (loading && !data) return <PageLoader message="Loading executive dashboard…" />

  if (error && !data) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <div className="p-3 bg-destructive/10 inline-block rounded-2xl">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Failed to Load Dashboard</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={() => loadData()} className="rounded-2xl px-5">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const {
    totalAllSellers = 0,
    totalProductSellers = 0,
    totalServiceSellers = 0,
    totalHotelSellers = 0,
    totalRestaurantSellers = 0,
    pendingProductSellers = 0,
    pendingServiceSellers = 0,
    pendingHotelSellers = 0,
    pendingRestaurantSellers = 0,
    totalPendingSellers = 0,
    totalProducts = 0,
    activeProducts = 0,
    totalServices = 0,
    activeServices = 0,
    totalFoods = 0,
    activeFoods = 0,
    totalHotels = 0,
    activeHotels = 0,
    totalRiders = 0,
    approvedRiders = 0,
    pendingRiders = 0,
    totalOrders = 0,
    totalFoodOrders = 0,
    totalHotelBookings = 0,
    totalTransactions = 0,
    totalRevenue = 0,
    subscriptionRevenue = 0,
    adRevenue = 0,
    grossMerchandiseValue = 0,
    monthlyAnalytics = [],
  } = data

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 max-w-full overflow-x-hidden">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Admin Executive Dashboard
            </h1>
            <Badge variant="outline" className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full border-primary/20 text-primary bg-primary/5">
              Live Real-Time
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Multi-vendor operations, cross-category inventory, monthly revenue charts & delivery logistics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            size="sm"
            onClick={() => setIsAddSellerOpen(true)}
            className="rounded-2xl h-9.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white gap-2 font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Register a new product, service, restaurant, or hotel vendor"
          >
            <Plus className="h-4 w-4" />
            <span>Add Seller</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="rounded-2xl h-9.5 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium text-xs sm:text-sm"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* ── Pending Approvals Alert Banner ── */}
      {(totalPendingSellers > 0 || pendingRiders > 0) && (
        <Card className="border-none shadow-lg bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent relative overflow-hidden rounded-3xl border border-amber-200/60 dark:border-amber-900/40">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Clock className="h-24 w-24 text-amber-600 rotate-12" />
          </div>
          <CardHeader className="p-5 sm:p-6 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 rounded-2xl text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-200">
                  Pending Approvals Require Verification
                </CardTitle>
                <CardDescription className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  {totalPendingSellers > 0 && (
                    <span>
                      {totalPendingSellers} seller application{totalPendingSellers !== 1 ? "s" : ""} waiting for review (
                      {pendingProductSellers > 0 && `${pendingProductSellers} Product, `}
                      {pendingServiceSellers > 0 && `${pendingServiceSellers} Service, `}
                      {pendingRestaurantSellers > 0 && `${pendingRestaurantSellers} Restaurant, `}
                      {pendingHotelSellers > 0 && `${pendingHotelSellers} Hotel`}
                      ).{" "}
                    </span>
                  )}
                  {pendingRiders > 0 && (
                    <span>{pendingRiders} delivery rider{pendingRiders !== 1 ? "s" : ""} awaiting background check.</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 flex items-center gap-2.5 flex-wrap">
            {totalPendingSellers > 0 && (
              <Link href="/admin/all-sellers?status=PENDING">
                <Button size="sm" className="rounded-xl px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm">
                  Review Seller Applications <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
            {pendingRiders > 0 && (
              <Link href="/admin/riders">
                <Button size="sm" variant="outline" className="rounded-xl px-4 text-xs font-semibold border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 gap-1.5">
                  Review Riders ({pendingRiders}) <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SECTION 1: Multi-Vendor Network (All Sellers, Products, Services, Restaurants, Hotels, Riders) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Vendor Network & Fleet Directory
          </h2>
          <Link href="/admin/all-sellers" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Master Directory <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: All Sellers (Combined) */}
          <Link href="/admin/all-sellers" className="group">
            <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-blue-500/20">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider truncate">
                    All Sellers
                  </p>
                  <div className="p-1.5 rounded-xl bg-blue-600 text-white shadow-sm group-hover:scale-110 transition-transform">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                  {totalAllSellers.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  All 4 seller categories
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2: Product Sellers */}
          <Link href="/admin/all-sellers?sellerType=PRODUCT" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider truncate">
                    Product Sellers
                  </p>
                  <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalProductSellers.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  Physical merchandise vendors
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 3: Service Sellers */}
          <Link href="/admin/all-sellers?sellerType=SERVICE" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">
                    Service Sellers
                  </p>
                  <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
                    <Wrench className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalServiceSellers.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  Service & booking providers
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 4: Restaurant Sellers */}
          <Link href="/admin/all-sellers?sellerType=RESTAURANT" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
                    Restaurant Sellers
                  </p>
                  <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalRestaurantSellers.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  Dining & food sellers
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 5: Hotel Sellers */}
          <Link href="/admin/all-sellers?sellerType=HOTEL" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">
                    Hotel Sellers
                  </p>
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalHotelSellers.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  Hotel & lodging accounts
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 6: Delivery Riders */}
          <Link href="/admin/riders" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider truncate">
                    Riders Fleet
                  </p>
                  <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 group-hover:scale-110 transition-transform">
                    <Bike className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalRiders.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {approvedRiders} active approved riders
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* ── SECTION 2: Catalog & Marketplace Offerings Counts ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-600" />
            Catalog Listings & Transaction Volume
          </h2>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Products Count */}
          <Link href="/admin/products" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    Products
                  </p>
                  <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalProducts.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {activeProducts} active product listings
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Services Count */}
          <Link href="/admin/services" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    Services
                  </p>
                  <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalServices.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {activeServices} active service offerings
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Restaurant Foods Count */}
          <Link href="/admin/restaurant-foods" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    Food Items
                  </p>
                  <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600">
                    <Utensils className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalFoods.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {activeFoods} active restaurant dishes
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Hotels Count */}
          <Link href="/admin/hotels" className="group">
            <Card className="border-none shadow-md bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-border/60">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    Hotels Listed
                  </p>
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {totalHotels.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {activeHotels} active hotel properties
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Total Transactions (Orders + Food + Hotels) */}
          <Link href="/admin/orders" className="group">
            <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-3xl h-full border border-indigo-500/20">
              <CardContent className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider truncate">
                    Total Transactions
                  </p>
                  <div className="p-1.5 rounded-xl bg-indigo-600 text-white">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {totalTransactions.toLocaleString()}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {totalOrders} e-comm, {totalFoodOrders} food, {totalHotelBookings} stays
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* ── SECTION 3: Financial & Revenue Performance ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Financial Performance & Marketplace Turnover
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Platform Revenue */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent relative overflow-hidden rounded-3xl group border border-emerald-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    Platform Direct Revenue
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Subscriptions & direct ad revenues</CardDescription>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Platform retained net revenue</p>
            </CardContent>
          </Card>

          {/* Subscription Revenue */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent relative overflow-hidden rounded-3xl group border border-blue-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    Subscription Revenue
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Income from vendor plan tiers</CardDescription>
                </div>
                <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(subscriptionRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Across all registered seller plans</p>
            </CardContent>
          </Card>

          {/* Ad Revenue */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent relative overflow-hidden rounded-3xl group border border-orange-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <BadgeDollarSign className="h-5 w-5 text-orange-500" />
                    Ad Promotion Revenue
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Income from sponsored placements</CardDescription>
                </div>
                <div className="p-2.5 bg-orange-500/10 text-orange-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <BadgeDollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-black text-orange-600 dark:text-orange-400">
                {formatCurrency(adRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Paid ad campaigns & impressions</p>
            </CardContent>
          </Card>

          {/* Gross Merchandise Value (GMV) */}
          <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent relative overflow-hidden rounded-3xl group border border-indigo-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    Gross Volume (GMV)
                  </CardTitle>
                  <CardDescription className="text-xs font-medium">Total marketplace transactions</CardDescription>
                </div>
                <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(grossMerchandiseValue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">E-comm goods, food & hotel bookings</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 4: Interactive Graphical Bar Chart ── */}
      <MonthlyBarChart data={monthlyAnalytics} />

      {/* ── SECTION 5: Quick Actions Navigation Hub ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" />
          Administrative Hub & Moderation Shortcuts
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            {
              href: "/admin/all-sellers",
              title: "Master Sellers Directory",
              desc: "Moderate all 4 vendor categories & bulk email",
              icon: Users,
              color: "text-blue-600 bg-blue-500/10",
            },
            {
              href: "/admin/products",
              title: "Product Inventory",
              desc: "Inspect products, categories & stock status",
              icon: Package,
              color: "text-blue-600 bg-blue-500/10",
            },
            {
              href: "/admin/services",
              title: "Services & Bookings",
              desc: "Review service listings, packages & slots",
              icon: Wrench,
              color: "text-purple-600 bg-purple-500/10",
            },
            {
              href: "/admin/restaurant-foods",
              title: "Restaurant Food Items",
              desc: "Manage dishes, menus & restaurant meals",
              icon: UtensilsCrossed,
              color: "text-amber-600 bg-amber-500/10",
            },
            {
              href: "/admin/hotels",
              title: "Hotels & Properties",
              desc: "Monitor hotel rooms, rates & amenities",
              icon: Building2,
              color: "text-emerald-600 bg-emerald-500/10",
            },
            {
              href: "/admin/riders",
              title: "Rider Fleet Management",
              desc: "Approve driver licenses, vehicles & zones",
              icon: Bike,
              color: "text-teal-600 bg-teal-500/10",
            },
            {
              href: "/admin/riders/live-track",
              title: "Live GPS Tracking",
              desc: "Track real-time rider coordinates & deliveries",
              icon: Radio,
              color: "text-emerald-600 bg-emerald-500/10",
            },
            {
              href: "/admin/subscriptions",
              title: "Vendor Subscriptions",
              desc: "Configure monthly & annual vendor plans",
              icon: CreditCard,
              color: "text-indigo-600 bg-indigo-500/10",
            },
          ].map((action) => (
            <Link href={action.href} key={action.title}>
              <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-border/60 bg-card group h-full rounded-2xl">
                <CardHeader className="p-4 sm:p-5">
                  <CardTitle className="flex items-center justify-between font-bold text-sm sm:text-base group-hover:text-primary transition-colors">
                    {action.title}
                    <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110", action.color)}>
                      <action.icon className="h-4 w-4" />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors mt-1">
                    {action.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Add Seller Modal Dialog ── */}
      <AddSellerModal
        open={isAddSellerOpen}
        onOpenChange={setIsAddSellerOpen}
      />
    </div>
  )
}
