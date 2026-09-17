"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  Search,
  LayoutGrid,
  List,
  Package,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Tag,
  Boxes,
  Eye,
  UtensilsCrossed,
  Hotel,
  Briefcase,
} from "lucide-react"
import type { AnalyticsCatalogItem, AnalyticsTopItem } from "@/app/api/admin/sellers/[id]/analytics/route"
import { TopItemsBarChart } from "./seller-analytics-charts"

interface SellerAnalyticsCatalogTabProps {
  items: AnalyticsCatalogItem[]
  topItems: AnalyticsTopItem[]
  sellerType: string
}

export function SellerAnalyticsCatalogTab({
  items,
  topItems,
  sellerType,
}: SellerAnalyticsCatalogTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  const isProduct = sellerType === "PRODUCT"
  const isService = sellerType === "SERVICE"
  const isHotel = sellerType === "HOTEL"
  const isRestaurant = sellerType === "RESTAURANT"

  const singularLabel = isProduct
    ? "Product"
    : isService
      ? "Service"
      : isHotel
        ? "Property / Room"
        : "Menu Dish"

  const pluralLabel = isProduct
    ? "Products"
    : isService
      ? "Services"
      : isHotel
        ? "Properties"
        : "Food Items"

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        (item.name || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
            ? item.status === "ACTIVE"
            : statusFilter === "INACTIVE"
              ? item.status === "INACTIVE"
              : item.status === "OUT_OF_STOCK"

      return matchesSearch && matchesStatus
    })
  }, [items, searchQuery, statusFilter])

  // Category breakdown for Graph View
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {}
    items.forEach((item) => {
      if (!map[item.category]) map[item.category] = { count: 0, revenue: 0 }
      map[item.category].count += 1
      map[item.category].revenue += item.revenue
    })
    return Object.keys(map).map((category) => ({
      category,
      count: map[category].count,
      revenue: map[category].revenue,
    })).sort((a, b) => b.count - a.count)
  }, [items])

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${pluralLabel.toLowerCase()} by name or category...`}
              className="pl-9 h-9 rounded-2xl text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Status Filter */}
          <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl transition-all ${
                  statusFilter === st
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {st === "ALL" ? "All" : st === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>

          {/* View Toggle (List vs Graph) */}
          <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
                viewMode === "graph"
                  ? "bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Graph View
            </button>
          </div>
        </div>
      </div>

      {/* ═════════ VIEW MODE: GRAPH VIEW ═════════ */}
      {viewMode === "graph" ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Performers Chart */}
          <TopItemsBarChart items={topItems} sellerType={sellerType} />

          {/* Category Distribution Card */}
          <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Category Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Items uploaded across assigned classifications
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {categoryStats.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No categories available.</p>
              ) : (
                categoryStats.map((cat) => {
                  const percent = items.length > 0 ? Math.round((cat.count / items.length) * 100) : 0
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {cat.category}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {cat.count} {cat.count === 1 ? singularLabel.toLowerCase() : pluralLabel.toLowerCase()}
                          </span>
                          <span className="text-slate-400 text-[11px]">({percent}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ═════════ VIEW MODE: LIST VIEW ═════════ */
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Uploaded {pluralLabel} Directory
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredItems.length} of {items.length} total items registered by this partner
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full font-semibold">
              {filteredItems.length} Records
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Boxes className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-semibold text-sm">No {pluralLabel.toLowerCase()} match your criteria</p>
                <p className="text-xs text-slate-400">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                    <tr>
                      <th className="py-3.5 pl-6">{singularLabel}</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Price / Base</th>
                      {isProduct && <th className="py-3.5 px-4">Stock</th>}
                      {isHotel && <th className="py-3.5 px-4">Total Rooms</th>}
                      <th className="py-3.5 px-4">
                        {isHotel ? "Bookings" : isService ? "Appointments" : "Units Sold"}
                      </th>
                      <th className="py-3.5 px-4">Gross Revenue</th>
                      <th className="py-3.5 pr-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Title & Image */}
                        <td className="py-3.5 pl-6 font-medium">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : isHotel ? (
                                <Hotel className="h-4 w-4 text-slate-400" />
                              ) : isRestaurant ? (
                                <UtensilsCrossed className="h-4 w-4 text-slate-400" />
                              ) : isService ? (
                                <Briefcase className="h-4 w-4 text-slate-400" />
                              ) : (
                                <Package className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] text-xs">
                                {item.name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {item.id.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <Badge variant="secondary" className="text-[10px] font-medium rounded-md px-2 py-0.5">
                            {item.category}
                          </Badge>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(item.price)}
                        </td>

                        {/* Stock or Rooms */}
                        {isProduct && (
                          <td className="py-3.5 px-4 font-mono font-semibold">
                            {item.stockOrRooms != null ? (
                              item.stockOrRooms > 0 ? (
                                <span className="text-slate-700 dark:text-slate-300">{item.stockOrRooms} units</span>
                              ) : (
                                <span className="text-rose-500 font-bold">Out of stock</span>
                              )
                            ) : (
                              "–"
                            )}
                          </td>
                        )}

                        {isHotel && (
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.stockOrRooms ?? 1} rooms
                          </td>
                        )}

                        {/* Units Sold / Bookings */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.unitsOrBookings}
                        </td>

                        {/* Revenue */}
                        <td className="py-3.5 px-4 font-mono font-extrabold text-violet-600 dark:text-violet-400">
                          {formatCurrency(item.revenue)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 pr-6 text-right">
                          <Badge
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              item.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : item.status === "OUT_OF_STOCK"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {item.status === "ACTIVE" ? "Active" : item.status === "OUT_OF_STOCK" ? "Out of Stock" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
