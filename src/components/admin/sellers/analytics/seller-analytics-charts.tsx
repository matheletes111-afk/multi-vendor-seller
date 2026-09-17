"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  TrendingUp,
  BarChart3,
  PieChart,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  CreditCard,
  Layers,
  ArrowUpRight,
} from "lucide-react"
import type {
  AnalyticsTimeSeriesPoint,
  AnalyticsStatusCount,
  AnalyticsTopItem,
} from "@/app/api/admin/sellers/[id]/analytics/route"

interface RevenueTrendChartProps {
  data: AnalyticsTimeSeriesPoint[]
  timeframeLabel: string
}

export function RevenueTrendChart({ data, timeframeLabel }: RevenueTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<AnalyticsTimeSeriesPoint | null>(null)

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            Revenue & Sales Trend
          </CardTitle>
          <CardDescription className="text-xs">
            Sales volume recorded over {timeframeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[260px] text-center text-slate-400">
          <BarChart3 className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
          <p className="font-semibold text-sm">No transaction activity recorded yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Sales trends will chart here once orders are processed.</p>
        </CardContent>
      </Card>
    )
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 10)
  const totalRevenue = data.reduce((acc, d) => acc + d.revenue, 0)
  const totalOrders = data.reduce((acc, d) => acc + d.orders, 0)

  // Chart dimensions
  const height = 220
  const barWidth = Math.max(12, Math.min(36, Math.floor(650 / (data.length * 1.6))))

  return (
    <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Revenue & Sales Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Daily revenue volume and transaction count across {timeframeLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Period Total</span>
              <span className="text-base font-extrabold text-violet-600 dark:text-violet-400">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="text-right">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Orders</span>
              <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                {totalOrders}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Floating Tooltip Indicator */}
        <div className="h-8 mb-2 flex items-center justify-between text-xs px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          {hoveredPoint ? (
            <div className="flex items-center gap-4 w-full justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                📅 {hoveredPoint.label} ({hoveredPoint.date})
              </span>
              <div className="flex items-center gap-3 font-mono font-bold">
                <span className="text-violet-600 dark:text-violet-400">
                  {formatCurrency(hoveredPoint.revenue)}
                </span>
                <span className="text-slate-500 text-[11px]">
                  ({hoveredPoint.orders} order{hoveredPoint.orders !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
          ) : (
            <span className="text-slate-400 italic text-[11px]">
              Hover over bars to inspect daily revenue and order metrics
            </span>
          )}
        </div>

        {/* Bar Visualizer */}
        <div className="pt-4 flex items-end justify-between gap-1.5 overflow-x-auto min-h-[220px] pb-2">
          {data.map((point) => {
            const heightPercent = Math.max(8, Math.round((point.revenue / maxRevenue) * 100))
            const isHovered = hoveredPoint?.date === point.date

            return (
              <div
                key={point.date}
                className="flex-1 min-w-[20px] max-w-[48px] flex flex-col items-center gap-2 group cursor-pointer"
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Bar */}
                <div className="w-full flex items-end justify-center h-[170px] relative">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-xl transition-all duration-200 ${
                      isHovered
                        ? "bg-gradient-to-t from-violet-600 to-indigo-500 shadow-md shadow-violet-500/30 scale-105"
                        : point.revenue > 0
                          ? "bg-gradient-to-t from-violet-500/80 to-indigo-400/80 hover:opacity-100"
                          : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] font-medium truncate max-w-full tracking-tight transition-colors ${
                    isHovered
                      ? "text-violet-600 dark:text-violet-400 font-bold"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {point.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface OrderStatusBreakdownProps {
  breakdown: AnalyticsStatusCount[]
  totalOrders: number
}

export function OrderStatusBreakdown({ breakdown, totalOrders }: OrderStatusBreakdownProps) {
  return (
    <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <PieChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Fulfillment & Order Status
        </CardTitle>
        <CardDescription className="text-xs">
          Distribution across all lifecycle stages ({totalOrders} total)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {breakdown.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <p className="text-xs">No orders recorded in this timeframe.</p>
          </div>
        ) : (
          <>
            {/* Multi-segment visual bar */}
            <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden p-0.5 gap-0.5">
              {breakdown.map((item) => (
                <div
                  key={item.status}
                  style={{ width: `${Math.max(3, item.percentage)}%` }}
                  title={`${item.label}: ${item.count} (${item.percentage}%)`}
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.color === "emerald"
                      ? "bg-emerald-500"
                      : item.color === "amber"
                        ? "bg-amber-500"
                        : item.color === "blue"
                          ? "bg-blue-500"
                          : item.color === "rose"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                  }`}
                />
              ))}
            </div>

            {/* List breakdown */}
            <div className="space-y-2.5 pt-1">
              {breakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        item.color === "emerald"
                          ? "bg-emerald-500"
                          : item.color === "amber"
                            ? "bg-amber-500"
                            : item.color === "blue"
                              ? "bg-blue-500"
                              : item.color === "rose"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                      }`}
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                      {item.label.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{item.count}</span>
                    <span className="text-[11px] text-slate-400 font-medium">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface TopItemsBarChartProps {
  items: AnalyticsTopItem[]
  sellerType: string
}

export function TopItemsBarChart({ items, sellerType }: TopItemsBarChartProps) {
  const isProduct = sellerType === "PRODUCT"
  const isService = sellerType === "SERVICE"
  const isHotel = sellerType === "HOTEL"
  const isRestaurant = sellerType === "RESTAURANT"

  const title = isProduct
    ? "Top 5 Best-Selling Products"
    : isService
      ? "Top Booked Services"
      : isHotel
        ? "Top Booked Properties"
        : "Top Ordered Dishes"

  const maxRevenue = Math.max(...items.map((i) => i.revenue), 10)

  return (
    <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
      <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">
          Ranked by gross sales volume generated
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {items.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <p className="text-xs">No sales recorded for catalog items yet.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const percent = Math.max(10, Math.round((item.revenue / maxRevenue) * 100))

            return (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                    <span className="text-slate-400 mr-1.5 font-mono">#{idx + 1}</span>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.units} {isHotel ? "nights" : isService ? "bookings" : "units"}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${percent}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
