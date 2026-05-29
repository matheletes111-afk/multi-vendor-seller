"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Input } from "@/ui/input"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import {
  TrendingUp,
  Users,
  CheckCircle,
  Layers,
  Filter,
  Calendar,
  X,
  ArrowRight
} from "lucide-react"

const formatPlanDuration = (durationDays?: number) => {
  const days = durationDays || 30
  if (days === 30) return "/month"
  if (days === 90) return "/3 months"
  if (days === 180) return "/6 months"
  if (days === 365) return "/year"
  return `/${days} days`
}

const formatPlanDurationShort = (durationDays?: number) => {
  const days = durationDays || 30
  if (days === 30) return " /mo"
  if (days === 90) return " /3mo"
  if (days === 180) return " /6mo"
  if (days === 365) return " /yr"
  return ` /${days}d`
}

export function SubscriptionsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  // Filter states from URL
  const year = searchParams.get("year") || ""
  const month = searchParams.get("month") || ""
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""

  const [data, setData] = useState<{
    subscriptions: any[]
    totalCount: number
    totalPages: number
    stats: { totalCount: number; activeCount: number; totalRevenue: number; plansCount: number }
    plans: any[]
    planCountMap: Record<string, number>
    planActiveMap: Record<string, number>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    return `/api/admin/subscriptions?${params.toString()}`
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch subscriptions")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchUrl])

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    // Reset to page 1 when filters change
    params.set("page", "1")
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push(pathname)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageLoader message="Loading subscription data…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="py-12 text-center text-destructive">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const { stats, plans, planCountMap, planActiveMap, subscriptions, totalCount, totalPages } = data

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())
  const months = [
    { label: "January", value: "1" },
    { label: "February", value: "2" },
    { label: "March", value: "3" },
    { label: "April", value: "4" },
    { label: "May", value: "5" },
    { label: "June", value: "6" },
    { label: "July", value: "7" },
    { label: "August", value: "8" },
    { label: "September", value: "9" },
    { label: "October", value: "10" },
    { label: "November", value: "11" },
    { label: "December", value: "12" },
  ]

  const currentTab = (searchParams.get("sellerType") || "PRODUCT_SERVICE").toUpperCase()

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">
            Subscription Management
          </h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">
            Monitor revenue trends and manage seller plans
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm font-medium">
            {totalCount} Total Records
          </Badge>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="flex border-b border-muted gap-2">
        {[
          { id: "PRODUCT_SERVICE", label: "Product & Service" },
          { id: "HOTEL", label: "Hotels" },
          { id: "RESTAURANT", label: "Restaurants" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => updateFilters({ sellerType: tab.id })}
            className={cn(
              "px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-200",
              currentTab === tab.id
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-blue-500/10 to-transparent dark:from-blue-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-full">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {from || to || year ? "For selected period" : "Lifetime volume"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-500/10 to-transparent dark:from-green-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
              <div className="p-2 bg-green-500/10 rounded-full">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium text-green-600 dark:text-green-400">
              {stats.activeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently generating revenue
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-purple-500/10 to-transparent dark:from-purple-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sellers</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-full">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time subscribers
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-orange-500/10 to-transparent dark:from-orange-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Plans</CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-full">
                <Layers className="w-4 h-4 text-orange-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium">{stats.plansCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Configured service tiers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border-none shadow-sm bg-muted/30">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <CardTitle className="text-lg font-medium">Revenue Filters</CardTitle>
          </div>
          {(year || month || from || to) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs font-medium bg-background hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear All Filters
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Yearly
              </label>
              <Select
                value={year}
                onValueChange={(val) => updateFilters({ year: val, from: null, to: null })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Monthly
              </label>
              <Select
                value={month}
                onValueChange={(val) => updateFilters({ month: val, from: null, to: null })}
                disabled={!year}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={year ? "Select Month" : "Pick Year First"} />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Custom Range
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => updateFilters({ from: e.target.value, year: null, month: null })}
                  className="bg-background"
                />
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => updateFilters({ to: e.target.value, year: null, month: null })}
                  className="bg-background"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-medium flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Subscription Plans
          </h2>
          <Link href="/admin/subscriptions/new">
            <Button className="font-semibold bg-primary hover:bg-primary/95">
              + Create Plan
            </Button>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan: any) => {
            const planTotal = planCountMap[plan.id] ?? 0
            const planActive = planActiveMap[plan.id] ?? 0
            return (
              <Card key={plan.id} className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-medium">{plan.displayName}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">{plan.description}</CardDescription>
                    </div>
                    <Link href={`/admin/subscriptions/edit/${plan.id}`}>
                      <Button variant="ghost" size="icon" className="rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-medium">{formatCurrency(plan.price)}</span>
                    {plan.price > 0 && <span className="text-muted-foreground font-medium text-sm">{formatPlanDuration(plan.duration)}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted px-3 py-2 rounded-lg">
                      <p className="text-muted-foreground text-xs uppercase font-medium">Active</p>
                      <p className="text-lg font-medium">{planActive}</p>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-lg">
                      <p className="text-muted-foreground text-xs uppercase font-medium">Total</p>
                      <p className="text-lg font-medium">{planTotal}</p>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-lg col-span-2 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs uppercase font-medium">Est. Monthly Revenue</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(planActive * plan.price)}</p>
                    </div>
                  </div>

                  {plan.type === "HOTEL" ? (
                    <div className="space-y-2 pt-2 border-t text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Hotels</span>
                        <span className="font-medium">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Rooms</span>
                        <span className="font-medium">{plan.maxRooms === null || plan.maxRooms === undefined ? "Unlimited" : plan.maxRooms}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Orders / Bookings</span>
                        <span className="font-medium">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/mo`}</span>
                      </div>
                    </div>
                  ) : plan.type === "RESTAURANT" ? (
                    <div className="space-y-2 pt-2 border-t text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Menu Items</span>
                        <span className="font-medium">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Orders</span>
                        <span className="font-medium">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/mo`}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2 border-t text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Products / Services</span>
                        <span className="font-medium">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Orders</span>
                        <span className="font-medium">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/mo`}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden transition-all duration-500">
        <CardHeader className="bg-muted/30 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Detailed Subscription History</CardTitle>
              <CardDescription>
                Showing {subscriptions.length} of {totalCount} total subscriptions matching filters
              </CardDescription>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Refreshing...
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/20">
                <TableHead className="py-4 pl-6">Seller / Store</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="pr-6">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Filter className="w-12 h-12 opacity-20" />
                      <p className="text-lg font-medium">No results found for current filters</p>
                      <Button variant="link" onClick={clearFilters}>Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription: any) => (
                  <TableRow key={subscription.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="py-4 pl-6">
                      <div className="font-medium text-foreground">
                        {subscription.seller?.store?.name || subscription.seller?.user?.email}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {subscription.seller?.user?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium whitespace-nowrap">
                        {subscription.seller?.type === "PRODUCT"
                          ? "Product Seller"
                          : subscription.seller?.type === "SERVICE"
                            ? "Service Seller"
                            : subscription.seller?.type === "HOTEL"
                              ? "Hotel Seller"
                              : "Restaurant Seller"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-primary">
                        {subscription.plan?.displayName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="rounded-full px-3"
                        variant={
                          subscription.status === "ACTIVE"
                            ? "default"
                            : subscription.status === "CANCELED"
                              ? "secondary"
                              : subscription.status === "PAST_DUE"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(subscription.plan?.price ?? 0)}
                        {(subscription.plan?.price ?? 0) > 0 && (
                          <span className="text-muted-foreground text-xs font-normal">
                            {formatPlanDurationShort(subscription.plan?.duration)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-medium">
                      {subscription.currentPeriodStart && subscription.currentPeriodEnd
                        ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground pr-6 font-medium">
                      {formatDate(subscription.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalCount > 0 && (
          <div className="border-t p-6 bg-muted/10">
            <AdminPagination
              basePath="/admin/subscriptions"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={searchParams}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
