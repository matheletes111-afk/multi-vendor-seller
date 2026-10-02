"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Wrench,
  UtensilsCrossed,
  Building2,
  Bike,
  Users,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
  Sparkles,
  Info,
} from "lucide-react"

export interface MonthlyAnalyticItem {
  monthKey: string
  label: string
  shortLabel: string
  year: number
  month: number
  subscriptionRevenue: number
  adRevenue: number
  orderRevenue: number
  foodOrderRevenue: number
  hotelBookingRevenue: number
  totalRevenue: number
  platformRevenue: number
  gmv: number
  ordersCount: number
  foodOrdersCount: number
  hotelBookingsCount: number
  totalTransactions: number
  newProductSellers: number
  newServiceSellers: number
  newHotelSellers: number
  newRestaurantSellers: number
  totalNewSellers: number
  newProducts: number
  newServices: number
  newFoods: number
  newRiders: number
}

interface MonthlyBarChartProps {
  data: MonthlyAnalyticItem[]
}

type TimeframeFilter = "6M" | "12M" | "YTD"
type CategoryFilter = "ALL" | "PRODUCT" | "SERVICE" | "RESTAURANT" | "HOTEL" | "RIDER"
type MetricType = "revenue" | "counts"

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("12M")
  const [category, setCategory] = useState<CategoryFilter>("ALL")
  const [metricType, setMetricType] = useState<MetricType>("revenue")
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Filter months based on timeframe
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    const now = new Date()
    const currentYear = now.getFullYear()

    if (timeframe === "6M") {
      return data.slice(-6)
    }
    if (timeframe === "YTD") {
      return data.filter((d) => d.year === currentYear)
    }
    return data.slice(-12)
  }, [data, timeframe])

  // Compute values for chart scaling based on Category & MetricType
  const chartItems = useMemo(() => {
    return filteredData.map((d) => {
      let primaryValue = 0
      let metricLabel = ""
      let secondaryText = ""

      if (metricType === "revenue") {
        switch (category) {
          case "PRODUCT":
            primaryValue = d.orderRevenue
            metricLabel = "Product Orders GMV"
            secondaryText = `${d.ordersCount} orders`
            break
          case "SERVICE":
            // Service portion of orders + platform subscriptions
            primaryValue = d.orderRevenue * 0.4 + d.subscriptionRevenue * 0.3
            metricLabel = "Service Revenue Volume"
            secondaryText = "Service orders & plans"
            break
          case "RESTAURANT":
            primaryValue = d.foodOrderRevenue
            metricLabel = "Food & Restaurant GMV"
            secondaryText = `${d.foodOrdersCount} food orders`
            break
          case "HOTEL":
            primaryValue = d.hotelBookingRevenue
            metricLabel = "Hotel Bookings GMV"
            secondaryText = `${d.hotelBookingsCount} bookings`
            break
          case "RIDER":
            // Platform revenue from deliveries (or total logistics throughput)
            primaryValue = (d.ordersCount + d.foodOrdersCount) * 1.5
            metricLabel = "Delivery Logistics Fees"
            secondaryText = `${d.ordersCount + d.foodOrdersCount} fulfilled runs`
            break
          case "ALL":
          default:
            primaryValue = d.platformRevenue + d.gmv
            metricLabel = "Total Platform & GMV"
            secondaryText = `${d.totalTransactions} transactions`
            break
        }
      } else {
        // MetricType === "counts"
        switch (category) {
          case "PRODUCT":
            primaryValue = d.ordersCount + d.newProducts
            metricLabel = "Products & Orders"
            secondaryText = `${d.newProducts} added, ${d.ordersCount} orders`
            break
          case "SERVICE":
            primaryValue = d.newServices + d.newServiceSellers
            metricLabel = "Services & Sellers"
            secondaryText = `${d.newServices} services, +${d.newServiceSellers} sellers`
            break
          case "RESTAURANT":
            primaryValue = d.foodOrdersCount + d.newFoods
            metricLabel = "Dishes & Food Orders"
            secondaryText = `${d.newFoods} foods, ${d.foodOrdersCount} orders`
            break
          case "HOTEL":
            primaryValue = d.hotelBookingsCount + d.newHotelSellers
            metricLabel = "Stays & Hotel Sellers"
            secondaryText = `${d.hotelBookingsCount} bookings, +${d.newHotelSellers} partners`
            break
          case "RIDER":
            primaryValue = d.newRiders
            metricLabel = "New Delivery Riders"
            secondaryText = `+${d.newRiders} riders joined`
            break
          case "ALL":
          default:
            primaryValue = d.totalTransactions
            metricLabel = "Total Orders & Bookings"
            secondaryText = `${d.ordersCount} goods, ${d.foodOrdersCount} meals, ${d.hotelBookingsCount} stays`
            break
        }
      }

      return {
        ...d,
        primaryValue,
        metricLabel,
        secondaryText,
      }
    })
  }, [filteredData, category, metricType])

  const maxValue = useMemo(() => {
    const max = Math.max(...chartItems.map((d) => d.primaryValue), 10)
    return max * 1.15 // 15% top padding
  }, [chartItems])

  // Summary statistics for selected category & timeframe
  const periodTotal = useMemo(() => {
    return chartItems.reduce((acc, d) => acc + d.primaryValue, 0)
  }, [chartItems])

  const peakMonth = useMemo(() => {
    if (chartItems.length === 0) return null
    return chartItems.reduce((max, cur) => (cur.primaryValue > max.primaryValue ? cur : max), chartItems[0])
  }, [chartItems])

  const activePoint = hoveredIndex !== null && chartItems[hoveredIndex] ? chartItems[hoveredIndex] : null

  // Category Theme Colors
  const categoryTheme = useMemo(() => {
    switch (category) {
      case "PRODUCT":
        return {
          barGradient: "bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400",
          accentColor: "text-blue-600 dark:text-blue-400",
          pillActive: "bg-blue-600 text-white",
        }
      case "SERVICE":
        return {
          barGradient: "bg-gradient-to-t from-purple-600 via-purple-500 to-indigo-400",
          accentColor: "text-purple-600 dark:text-purple-400",
          pillActive: "bg-purple-600 text-white",
        }
      case "RESTAURANT":
        return {
          barGradient: "bg-gradient-to-t from-amber-600 via-amber-500 to-orange-400",
          accentColor: "text-amber-600 dark:text-amber-400",
          pillActive: "bg-amber-600 text-white",
        }
      case "HOTEL":
        return {
          barGradient: "bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400",
          accentColor: "text-emerald-600 dark:text-emerald-400",
          pillActive: "bg-emerald-600 text-white",
        }
      case "RIDER":
        return {
          barGradient: "bg-gradient-to-t from-teal-600 via-teal-500 to-cyan-400",
          accentColor: "text-teal-600 dark:text-teal-400",
          pillActive: "bg-teal-600 text-white",
        }
      case "ALL":
      default:
        return {
          barGradient: "bg-gradient-to-t from-indigo-600 via-blue-500 to-cyan-400",
          accentColor: "text-indigo-600 dark:text-indigo-400",
          pillActive: "bg-indigo-600 text-white",
        }
    }
  }, [category])

  return (
    <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden transition-all duration-300">
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Monthly Performance & Activity Analytics
                  <Badge variant="outline" className="text-[11px] font-semibold rounded-full px-2 py-0.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                    Graphical Bars
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Monthly revenue breakdown and individual counts for Product, Service, Restaurant, Hotel sellers & Riders fleet.
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Metric Type & Timeframe Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Revenue vs Counts Toggle */}
            <div className="bg-muted/70 p-1 rounded-2xl flex items-center gap-1 border border-border/50">
              <button
                type="button"
                onClick={() => setMetricType("revenue")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  metricType === "revenue"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span>Monthly Revenue</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricType("counts")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  metricType === "counts"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <span>Individual Counts</span>
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="bg-muted/70 p-1 rounded-2xl flex items-center gap-1 border border-border/50">
              {(["6M", "12M", "YTD"] as TimeframeFilter[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    timeframe === tf
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tf === "6M" ? "Last 6M" : tf === "12M" ? "Last 12M" : "YTD"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-between gap-3 pt-3 flex-wrap border-t border-border/40 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Focus Category:
            </span>

            {[
              { key: "ALL", label: "All Ecosystem", icon: Users },
              { key: "PRODUCT", label: "Product Sellers & Goods", icon: Package },
              { key: "SERVICE", label: "Service Sellers & Bookings", icon: Wrench },
              { key: "RESTAURANT", label: "Restaurant Sellers & Foods", icon: UtensilsCrossed },
              { key: "HOTEL", label: "Hotel Sellers & Stays", icon: Building2 },
              { key: "RIDER", label: "Riders & Deliveries", icon: Bike },
            ].map((cat) => {
              const isSelected = category === cat.key
              const Icon = cat.icon
              return (
                <Button
                  key={cat.key}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={`rounded-xl text-xs h-7.5 px-3 font-semibold gap-1.5 transition-all ${
                    isSelected
                      ? categoryTheme.pillActive
                      : "border-border/80 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setCategory(cat.key as CategoryFilter)}
                >
                  <Icon className="h-3 w-3" />
                  <span>{cat.label}</span>
                </Button>
              )
            })}
          </div>

          <div className="text-right text-xs text-muted-foreground font-medium">
            {filteredData.length} Months Tracked
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Floating / Active Month Breakdown Banner */}
        <div className="p-3.5 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-[48px]">
          {activePoint ? (
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  📅 {activePoint.label}
                </span>
                <Badge variant="outline" className={`text-[11px] rounded-full border-primary/30 px-2 font-semibold ${categoryTheme.accentColor}`}>
                  {activePoint.metricLabel}
                </Badge>
              </div>

              {metricType === "revenue" ? (
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-extrabold text-foreground text-sm">
                    {formatCurrency(activePoint.primaryValue)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium text-muted-foreground">
                    {activePoint.secondaryText}
                  </span>
                  {category === "ALL" && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-semibold text-emerald-600">
                        Platform: {formatCurrency(activePoint.platformRevenue)}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-semibold text-indigo-600">
                        GMV: {formatCurrency(activePoint.gmv)}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-extrabold text-foreground text-sm">
                    {activePoint.primaryValue.toLocaleString()} items / volume
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium text-muted-foreground">
                    {activePoint.secondaryText}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 text-indigo-500" />
              <span>Hover or tap on any monthly bar to inspect exact values, revenue and counts for {category.toLowerCase()} category.</span>
            </div>
          )}

          {peakMonth && (
            <div className="text-right text-xs shrink-0">
              <span className="text-muted-foreground">Peak Month: </span>
              <strong className="text-foreground">{peakMonth.label}</strong>{" "}
              <span className={`font-bold ${categoryTheme.accentColor}`}>
                ({metricType === "revenue" ? formatCurrency(peakMonth.primaryValue) : `${peakMonth.primaryValue} items`})
              </span>
            </div>
          )}
        </div>

        {/* ── Graphical SVG/CSS Bars Container ── */}
        <div className="pt-2 pb-2">
          <div className="relative w-full h-[260px] sm:h-[300px] flex items-end gap-2 sm:gap-3 px-2 sm:px-4">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none opacity-25">
              <div className="border-b border-dashed border-border w-full flex justify-end pr-2 text-[10px] text-muted-foreground">
                {metricType === "revenue" ? formatCurrency(maxValue) : Math.round(maxValue)}
              </div>
              <div className="border-b border-dashed border-border w-full flex justify-end pr-2 text-[10px] text-muted-foreground">
                {metricType === "revenue" ? formatCurrency(maxValue * 0.75) : Math.round(maxValue * 0.75)}
              </div>
              <div className="border-b border-dashed border-border w-full flex justify-end pr-2 text-[10px] text-muted-foreground">
                {metricType === "revenue" ? formatCurrency(maxValue * 0.5) : Math.round(maxValue * 0.5)}
              </div>
              <div className="border-b border-dashed border-border w-full flex justify-end pr-2 text-[10px] text-muted-foreground">
                {metricType === "revenue" ? formatCurrency(maxValue * 0.25) : Math.round(maxValue * 0.25)}
              </div>
              <div className="border-b border-border w-full flex justify-end pr-2 text-[10px] text-muted-foreground">
                0
              </div>
            </div>

            {/* Individual Monthly Bars */}
            {chartItems.map((item, index) => {
              const heightPercent = Math.max(6, Math.min(100, (item.primaryValue / maxValue) * 100))
              const isHovered = hoveredIndex === index

              return (
                <div
                  key={item.monthKey}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer z-10 relative"
                >
                  {/* Floating Micro Tooltip on Bar Hover */}
                  {isHovered && (
                    <div className="absolute -top-12 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xl pointer-events-none whitespace-nowrap z-30 animate-in fade-in zoom-in-95 duration-150">
                      {metricType === "revenue" ? formatCurrency(item.primaryValue) : `${item.primaryValue}`}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45" />
                    </div>
                  )}

                  {/* The Vertical Bar */}
                  <div className="w-full max-w-[42px] h-[calc(100%-2rem)] flex items-end justify-center">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-xl transition-all duration-300 relative overflow-hidden ${
                        isHovered ? "scale-y-[1.02] shadow-lg shadow-primary/25 brightness-110" : ""
                      } ${categoryTheme.barGradient}`}
                    />
                  </div>

                  {/* X-Axis Label */}
                  <div className="h-8 flex items-center justify-center text-center mt-1">
                    <span
                      className={`text-[10px] sm:text-xs font-medium transition-colors ${
                        isHovered
                          ? "text-primary font-bold"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Key Highlights Row Under Chart ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2 border-t border-border/60">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Period Total
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {metricType === "revenue" ? formatCurrency(periodTotal) : periodTotal.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {metricType === "revenue" ? "Selected Category Revenue" : "Selected Category Counts"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Monthly Average
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {metricType === "revenue"
                ? formatCurrency(chartItems.length > 0 ? periodTotal / chartItems.length : 0)
                : Math.round(chartItems.length > 0 ? periodTotal / chartItems.length : 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground">Average per month ({timeframe})</p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Peak Month Volume
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {peakMonth ? (metricType === "revenue" ? formatCurrency(peakMonth.primaryValue) : peakMonth.primaryValue.toLocaleString()) : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground">{peakMonth ? peakMonth.label : "Highest month"}</p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Fleet & Onboarding
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">
              +{filteredData.reduce((acc, d) => acc + d.newRiders + d.totalNewSellers, 0)}
            </div>
            <p className="text-[10px] text-muted-foreground">New sellers & riders in period</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-1 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-md ${categoryTheme.barGradient}`} />
            <span className="capitalize">{category.toLowerCase()} {metricType}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database live synchronized</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
