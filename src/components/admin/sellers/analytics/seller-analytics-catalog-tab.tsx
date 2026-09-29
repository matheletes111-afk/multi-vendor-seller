"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Search,
  LayoutGrid,
  List,
  Package,
  Boxes,
  Eye,
  UtensilsCrossed,
  Hotel,
  Briefcase,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Truck,
  Calendar,
  Tag,
  Info,
  Clock,
} from "lucide-react"
import type {
  AnalyticsCatalogItem,
  AnalyticsTopItem,
} from "@/app/api/admin/sellers/[id]/analytics/route"
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
  const [selectedItem, setSelectedItem] = useState<AnalyticsCatalogItem | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [copiedId, setCopiedId] = useState(false)

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

  // Total variants across all items
  const totalVariantsCount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.variants?.length || 1), 0)
  }, [items])

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        (item.name || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q) ||
        (item.slug || "").toLowerCase().includes(q) ||
        (item.variants || []).some((v) =>
          (v.name || "").toLowerCase().includes(q) || (v.sku || "").toLowerCase().includes(q)
        )

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

  const filteredVariantsCount = useMemo(() => {
    return filteredItems.reduce((sum, it) => sum + (it.variants?.length || 1), 0)
  }, [filteredItems])

  // Category breakdown for Graph View
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {}
    items.forEach((item) => {
      if (!map[item.category]) map[item.category] = { count: 0, revenue: 0 }
      map[item.category].count += 1
      map[item.category].revenue += item.revenue
    })
    return Object.keys(map)
      .map((category) => ({
        category,
        count: map[category].count,
        revenue: map[category].revenue,
      }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  // Collect all unique images for modal gallery
  const modalImages = useMemo(() => {
    if (!selectedItem) return []
    const set = new Set<string>()

    if (selectedItem.images && selectedItem.images.length > 0) {
      selectedItem.images.forEach((img) => img && set.add(img))
    }
    if (selectedItem.image) {
      set.add(selectedItem.image)
    }
    if (selectedItem.variants) {
      selectedItem.variants.forEach((v) => {
        if (v.images && Array.isArray(v.images)) {
          v.images.forEach((img) => img && set.add(img))
        }
      })
    }
    return Array.from(set)
  }, [selectedItem])

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

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
              placeholder={`Search ${pluralLabel.toLowerCase()} by name, category, or variant...`}
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
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 w-full">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Uploaded {pluralLabel} Directory
                </CardTitle>
                {isProduct && (
                  <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {items.length} Products • {totalVariantsCount} Total Variants
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5">
                Showing {filteredItems.length} of {items.length} total items
                {isProduct && ` (${filteredVariantsCount} total variants)`} registered by this partner
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {isProduct && (
                <Badge
                  variant="outline"
                  className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                >
                  <Layers className="h-3 w-3 mr-1 inline" />
                  {filteredVariantsCount} Total Variants
                </Badge>
              )}
              <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full font-semibold">
                {filteredItems.length} {pluralLabel}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Boxes className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-semibold text-sm">No {pluralLabel.toLowerCase()} match your criteria</p>
                <p className="text-xs text-slate-400">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs table-auto min-w-[960px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                    <tr>
                      <th className="py-3.5 pl-5 pr-3 min-w-[210px] max-w-[260px]">{singularLabel}</th>
                      <th className="py-3.5 px-3 min-w-[110px]">Category</th>
                      {isProduct && (
                        <th className="py-3.5 px-3 min-w-[180px] max-w-[240px]">
                          <div className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            <span>Variants (Count)</span>
                          </div>
                        </th>
                      )}
                      <th className="py-3.5 px-3 min-w-[95px]">Price / Base</th>
                      {isProduct && <th className="py-3.5 px-3 min-w-[85px]">Stock</th>}
                      {isHotel && <th className="py-3.5 px-3 min-w-[95px]">Total Rooms</th>}
                      <th className="py-3.5 px-3 min-w-[80px]">
                        {isHotel ? "Bookings" : isService ? "Appointments" : "Units Sold"}
                      </th>
                      <th className="py-3.5 px-3 min-w-[100px]">Gross Revenue</th>
                      <th className="py-3.5 px-3 min-w-[90px]">Status</th>
                      <th className="py-3.5 pl-3 pr-5 min-w-[115px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map((item) => {
                      const vCount = item.variants?.length || 1

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Title & Image */}
                          <td className="py-3 pl-5 pr-3 font-medium">
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
                              <div className="min-w-0 flex-1">
                                <p
                                  className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px] text-xs"
                                  title={item.name}
                                >
                                  {item.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono flex-wrap">
                                  <span>ID: {item.id.slice(-6)}</span>
                                  {isProduct && (
                                    <>
                                      <span>•</span>
                                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                        {vCount} {vCount === 1 ? "variant" : "variants"}
                                      </span>
                                    </>
                                  )}
                                  {item.condition && (
                                    <>
                                      <span>•</span>
                                      <span className="uppercase text-[9px] font-semibold text-slate-500">
                                        {item.condition}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3">
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium rounded-md px-2 py-0.5 max-w-[110px] truncate block"
                              title={item.category}
                            >
                              {item.category}
                            </Badge>
                          </td>

                          {/* Variants Column with Prominent Count and List */}
                          {isProduct && (
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1 max-w-[230px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md shadow-none ${
                                      vCount > 1
                                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                    }`}
                                  >
                                    <Layers className="h-3 w-3 mr-1 inline" />
                                    {vCount} {vCount === 1 ? "Variant" : "Variants"}
                                  </Badge>

                                  {item.variants && item.variants.some((v) => v.stock === 0) && (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 rounded">
                                      Out of stock
                                    </Badge>
                                  )}
                                </div>

                                {item.variants && item.variants.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.variants.slice(0, 3).map((v) => (
                                      <span
                                        key={v.id}
                                        className="inline-flex items-center text-[10px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium truncate max-w-[130px] border border-slate-200/60 dark:border-slate-700/60"
                                        title={`${v.name} | Price: ${formatCurrency(v.price)} | Stock: ${v.stock}`}
                                      >
                                        {v.name}
                                      </span>
                                    ))}
                                    {item.variants.length > 3 && (
                                      <span className="text-[10px] text-slate-400 font-semibold self-center">
                                        +{item.variants.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Standard listing</span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Price */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {formatCurrency(item.price)}
                          </td>

                          {/* Stock or Rooms */}
                          {isProduct && (
                            <td className="py-3 px-3 font-mono font-semibold whitespace-nowrap">
                              {item.stockOrRooms != null ? (
                                item.stockOrRooms > 0 ? (
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {item.stockOrRooms} units
                                  </span>
                                ) : (
                                  <span className="text-rose-500 font-bold">Out of stock</span>
                                )
                              ) : (
                                "–"
                              )}
                            </td>
                          )}

                          {isHotel && (
                            <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {item.stockOrRooms ?? 1} rooms
                            </td>
                          )}

                          {/* Units Sold / Bookings */}
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {item.unitsOrBookings}
                          </td>

                          {/* Revenue */}
                          <td className="py-3 px-3 font-mono font-extrabold text-violet-600 dark:text-violet-400 whitespace-nowrap">
                            {formatCurrency(item.revenue)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
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

                          {/* View Details Button */}
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(item)
                                setActiveImageIndex(0)
                              }}
                              className="h-7 px-2.5 rounded-xl border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[11px] font-semibold gap-1.5 shadow-none transition-all group-hover:border-blue-300 dark:group-hover:border-blue-700"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span>View Details</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═════════ PRODUCT / ITEM DETAILS POPUP MODAL ═════════ */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 gap-0 border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
          {selectedItem && (
            <div className="flex flex-col">
              {/* Top Accent Gradient */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 pr-6">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="secondary" className="font-semibold text-[11px] rounded-md px-2 py-0.5">
                      {selectedItem.category}
                    </Badge>
                    {selectedItem.subcategory && (
                      <Badge variant="outline" className="text-[11px] rounded-md px-2 py-0.5">
                        {selectedItem.subcategory}
                      </Badge>
                    )}
                    {selectedItem.condition && (
                      <Badge variant="outline" className="text-[11px] rounded-md px-2 py-0.5 uppercase font-mono">
                        Condition: {selectedItem.condition}
                      </Badge>
                    )}
                    <Badge
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        selectedItem.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : selectedItem.status === "OUT_OF_STOCK"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {selectedItem.status === "ACTIVE" ? "Active" : selectedItem.status === "OUT_OF_STOCK" ? "Out of Stock" : "Inactive"}
                    </Badge>

                    {/* Prominent Variant Count Pill in Header */}
                    <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      <Layers className="h-3 w-3 mr-1 inline" />
                      {selectedItem.variants?.length || 1} Total { (selectedItem.variants?.length || 1) === 1 ? "Variant" : "Variants" }
                    </Badge>
                  </div>

                  <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {selectedItem.name}
                  </DialogTitle>

                  <DialogDescription className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">ID: {selectedItem.id}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedItem.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {copiedId ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy ID
                        </>
                      )}
                    </button>
                    {selectedItem.slug && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-400">/{selectedItem.slug}</span>
                      </>
                    )}
                  </DialogDescription>
                </div>

                {/* External link if slug available */}
                {selectedItem.slug && (
                  <div className="shrink-0 pt-1">
                    <a
                      href={`/products/${selectedItem.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-sm transition-all"
                    >
                      <span>Store Page</span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                  </div>
                )}
              </div>

              {/* Modal Content Body */}
              <div className="p-6 space-y-6">
                {/* Variant Count Summary Banner */}
                <div className="flex items-center justify-between p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-indigo-950 dark:text-indigo-100">
                        {selectedItem.variants?.length || 1} Configured { (selectedItem.variants?.length || 1) === 1 ? "Variant" : "Variants" }
                      </p>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-300">
                        Each variant represents a distinct option (color, size, storage) imported for this product.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    {selectedItem.variants?.length || 1} Options
                  </span>
                </div>

                {/* Top Section: Gallery + Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left: Image Gallery */}
                  <div className="md:col-span-5 space-y-3">
                    <div className="w-full aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative shadow-inner">
                      {modalImages.length > 0 && modalImages[activeImageIndex] ? (
                        <img
                          src={modalImages[activeImageIndex]}
                          alt={selectedItem.name}
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Package className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                          <span className="text-xs font-medium">No Image Uploaded</span>
                        </div>
                      )}
                    </div>

                    {/* Thumbnail strip */}
                    {modalImages.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {modalImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImageIndex(idx)}
                            className={`h-14 w-14 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                              activeImageIndex === idx
                                ? "border-blue-600 shadow-sm ring-2 ring-blue-500/20"
                                : "border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Key Performance & Inventory Cards */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Price */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Base / Starting Price
                        </span>
                        <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(selectedItem.price)}
                        </span>
                      </div>

                      {/* Total Stock */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Total Stock In Hand
                        </span>
                        <span
                          className={`text-xl font-black font-mono ${
                            (selectedItem.stockOrRooms ?? 0) > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500"
                          }`}
                        >
                          {selectedItem.stockOrRooms != null
                            ? `${selectedItem.stockOrRooms} Units`
                            : "Unlimited"}
                        </span>
                      </div>

                      {/* Units Sold */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Lifetime Sold
                        </span>
                        <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                          {selectedItem.unitsOrBookings} Units
                        </span>
                      </div>

                      {/* Revenue */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Gross Revenue
                        </span>
                        <span className="text-xl font-black text-violet-600 dark:text-violet-400 font-mono">
                          {formatCurrency(selectedItem.revenue)}
                        </span>
                      </div>
                    </div>

                    {/* Logistics & Delivery Info */}
                    <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Truck className="h-3.5 w-3.5 text-blue-500" /> Delivery Charge per KM
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(selectedItem.deliveryChargePerKm || 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-emerald-500" /> Uploaded Date
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {formatDate(selectedItem.createdAt)}
                        </span>
                      </div>

                      {selectedItem.updatedAt && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Last Modified
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {formatDate(selectedItem.updatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Product Description */}
                {selectedItem.description && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-500" /> Product Description & Specification
                    </span>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedItem.description}
                    </div>
                  </div>
                )}

                {/* ═════════ ALL PRODUCT VARIANTS SECTION ═════════ */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        All Product Variants ({selectedItem.variants?.length || 1})
                      </h4>
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[10px] font-bold px-2 py-0.5">
                        {selectedItem.variants?.length || 1} Total In Database
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Showing complete variant inventory
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs table-auto min-w-[720px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          <tr>
                            <th className="py-2.5 pl-4 pr-2">Variant Name</th>
                            <th className="py-2.5 px-3">SKU</th>
                            <th className="py-2.5 px-3">Price</th>
                            <th className="py-2.5 px-3">Stock Status</th>
                            <th className="py-2.5 px-3">Attributes</th>
                            <th className="py-2.5 px-3">Dimensions / Wt</th>
                            <th className="py-2.5 pr-4 text-right">Return / Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedItem.variants && selectedItem.variants.length > 0 ? (
                            selectedItem.variants.map((v) => {
                              const attrObj = v.attributes && typeof v.attributes === "object" ? v.attributes : null
                              const attrEntries = attrObj ? Object.entries(attrObj) : []

                              return (
                                <tr
                                  key={v.id}
                                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                  {/* Variant Name & Image */}
                                  <td className="py-2.5 pl-4 pr-2 font-medium">
                                    <div className="flex items-center gap-2.5">
                                      {v.images && v.images.length > 0 ? (
                                        <img
                                          src={v.images[0]}
                                          alt={v.name}
                                          className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                                          <Package className="h-3.5 w-3.5 text-slate-400" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                          {v.name}
                                        </p>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          ID: {v.id.slice(-6)}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* SKU */}
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                    {v.sku ? (
                                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                        {v.sku}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400">–</span>
                                    )}
                                  </td>

                                  {/* Price */}
                                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                    {formatCurrency(v.price)}
                                    {v.discount > 0 && (
                                      <span className="ml-1 text-[10px] text-emerald-600 font-normal">
                                        (-{formatCurrency(v.discount)})
                                      </span>
                                    )}
                                  </td>

                                  {/* Stock Status */}
                                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                    {v.stock > 0 ? (
                                      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                                        {v.stock} in stock
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 text-[10px] font-semibold px-2 py-0.5">
                                        Out of stock
                                      </Badge>
                                    )}
                                  </td>

                                  {/* Attributes */}
                                  <td className="py-2.5 px-3">
                                    {attrEntries.length > 0 ? (
                                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {attrEntries.map(([k, val]) => (
                                          <span
                                            key={k}
                                            className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                                          >
                                            <span className="capitalize text-slate-400 mr-1">{k}:</span>
                                            {String(val)}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">–</span>
                                    )}
                                  </td>

                                  {/* Dimensions / Weight */}
                                  <td className="py-2.5 px-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {v.weight != null && v.weight > 0 ? `${v.weight} kg` : ""}
                                    {v.width && v.height && v.depth ? (
                                      <span className="block text-[10px] text-slate-400">
                                        {v.width}×{v.height}×{v.depth} cm
                                      </span>
                                    ) : (
                                      !v.weight && "–"
                                    )}
                                  </td>

                                  {/* Return policy / delivery */}
                                  <td className="py-2.5 pr-4 text-right text-[11px] whitespace-nowrap">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">
                                        {v.returnType?.replace(/_/g, " ") || "Non Returnable"}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        Delivery: {v.deliveryDays || 7}d
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          ) : (
                            /* Fallback standard row if single default variant */
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 pl-4 pr-2 font-medium">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  Standard Default Variant
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">–</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(selectedItem.price)}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 text-[10px] font-semibold px-2 py-0.5">
                                  {selectedItem.stockOrRooms ?? 0} in stock
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[11px]">–</td>
                              <td className="py-2.5 px-3 text-slate-400 text-[11px]">–</td>
                              <td className="py-2.5 pr-4 text-right text-[11px] text-slate-400">Default policy</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Seller Catalog Record #{selectedItem.id.slice(-8)}
                </span>
                <Button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-2xl px-5 text-xs font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
