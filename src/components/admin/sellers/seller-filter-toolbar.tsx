"use client"

import React, { useState, useEffect } from "react"
import {
  Search,
  X,
  Calendar,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ShieldCheck,
  Building2,
  Package,
  UtensilsCrossed,
  Wrench,
  Users,
} from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { cn } from "@/lib/utils"

export interface SellerFilterToolbarProps {
  search: string
  onSearchChange: (val: string) => void
  onSearchSubmit: (submittedSearch?: string) => void

  timeframe: string
  onTimeframeChange: (val: string) => void

  specificDate: string
  onSpecificDateChange: (val: string) => void

  startDate: string
  onStartDateChange: (val: string) => void

  endDate: string
  onEndDateChange: (val: string) => void

  docStatus: string
  onDocStatusChange: (val: string) => void

  status: string
  onStatusChange: (val: string) => void

  sellerType?: string
  onSellerTypeChange?: (val: string) => void
  sellerTypeOptions?: Array<{ value: string; label: string; icon?: React.ReactNode }>

  sortBy: string
  onSortByChange: (val: string) => void

  sortOrder: "asc" | "desc"
  onSortOrderChange: (val: "asc" | "desc") => void

  onReset: () => void
  totalCount?: number
  loading?: boolean
}

export function SellerFilterToolbar({
  search,
  onSearchChange,
  onSearchSubmit,
  timeframe,
  onTimeframeChange,
  specificDate,
  onSpecificDateChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  docStatus,
  onDocStatusChange,
  status,
  onStatusChange,
  sellerType,
  onSellerTypeChange,
  sellerTypeOptions,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onReset,
  totalCount,
  loading,
}: SellerFilterToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchChange(localSearch)
      onSearchSubmit(localSearch)
    }
  }

  // Combined sort value e.g. "createdAt_desc"
  const currentSortComposite = `${sortBy}_${sortOrder}`

  const handleCompositeSortChange = (compositeVal: string) => {
    const [field, order] = compositeVal.split("_") as [string, "asc" | "desc"]
    if (field && (order === "asc" || order === "desc")) {
      onSortByChange(field)
      onSortOrderChange(order)
    }
  }

  const hasActiveFilters = Boolean(
    search ||
    (timeframe && timeframe !== "all") ||
    specificDate ||
    startDate ||
    endDate ||
    (docStatus && docStatus !== "ALL") ||
    (status && status !== "ALL" && status !== "all") ||
    (sellerType && sellerType !== "ALL" && sellerType !== "all") ||
    sortBy !== "createdAt" ||
    sortOrder !== "desc"
  )

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 sm:p-5 shadow-sm transition-all max-w-full">
      {/* Top Search & Primary Filters Row */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
        {/* Search Bar - Takes available flex space */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value)
              onSearchChange(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search name, email, store, city, phone..."
            className="pl-10 pr-20 h-10 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus-visible:ring-2 focus-visible:ring-blue-500/30 w-full"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("")
                  onSearchChange("")
                  onSearchSubmit("")
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onSearchChange(localSearch)
                onSearchSubmit(localSearch)
              }}
              className="h-7 px-2.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
            >
              Search
            </Button>
          </div>
        </div>

        {/* 3 Filters Group - 3 equal responsive columns on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 xl:w-[560px] shrink-0">
          {/* Timeframe Selector (Daily, Weekly, Monthly, Specific Date, Custom) */}
          <div className="min-w-0">
            <Select
              value={timeframe || "all"}
              onValueChange={(val) => {
                onTimeframeChange(val)
                if (val !== "specific") onSpecificDateChange("")
                if (val !== "custom") {
                  onStartDateChange("")
                  onEndDateChange("")
                }
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-xs font-medium px-3 truncate">
                <Calendar className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">📅 All Time (Any Date)</SelectItem>
                <SelectItem value="today">⚡ Daily (Registered Today)</SelectItem>
                <SelectItem value="weekly">📆 Weekly (Last 7 Days)</SelectItem>
                <SelectItem value="monthly">🗓️ Monthly (Last 30 Days)</SelectItem>
                <SelectItem value="specific">🎯 Specific Single Date</SelectItem>
                <SelectItem value="custom">⏳ Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Document Status Selector */}
          <div className="min-w-0">
            <Select value={docStatus || "ALL"} onValueChange={onDocStatusChange}>
              <SelectTrigger className="h-10 w-full rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-xs font-medium px-3 truncate">
                <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <SelectValue placeholder="Documents" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="ALL">All Documents</SelectItem>
                <SelectItem value="COMPLETE">✅ Complete / Verified</SelectItem>
                <SelectItem value="INCOMPLETE">⚠️ Incomplete / Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="min-w-0">
            <Select value={status || "ALL"} onValueChange={onStatusChange}>
              <SelectTrigger className="h-10 w-full rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-xs font-medium px-3 truncate">
                <Filter className="h-4 w-4 mr-1.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending Review</SelectItem>
                <SelectItem value="APPROVED">Approved / Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="ONBOARDING">In Onboarding</SelectItem>
                <SelectItem value="CORRECTION_NEEDED">Correction Needed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conditional Date Pickers (Specific Date or Custom Range) */}
      {(timeframe === "specific" || timeframe === "custom") && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid gap-3 grid-cols-1 sm:grid-cols-12 items-center animate-in fade-in duration-300">
          {timeframe === "specific" && (
            <div className="sm:col-span-5 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">Specific Date:</label>
              <Input
                type="date"
                value={specificDate}
                onChange={(e) => onSpecificDateChange(e.target.value)}
                className="h-9.5 rounded-xl text-xs bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
              />
            </div>
          )}

          {timeframe === "custom" && (
            <>
              <div className="sm:col-span-4 flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">From:</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="h-9.5 rounded-xl text-xs bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                />
              </div>
              <div className="sm:col-span-4 flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">To:</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="h-9.5 rounded-xl text-xs bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Secondary Row: Seller Type Filter & Dedicated Sort By Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Optional Seller Type Selector */}
          {sellerTypeOptions && onSellerTypeChange && (
            <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              {sellerTypeOptions.map((opt) => {
                const isActive = (sellerType || "ALL").toUpperCase() === opt.value.toUpperCase()
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSellerTypeChange(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all text-xs",
                      isActive
                        ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Dedicated Comprehensive "Sort By" Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sort By:
            </span>
            <Select value={currentSortComposite} onValueChange={handleCompositeSortChange}>
              <SelectTrigger className="h-9.5 min-w-[210px] rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <SelectValue placeholder="Sort order..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl max-h-80">
                <SelectItem value="createdAt_desc">📅 Registration Date (Newest First)</SelectItem>
                <SelectItem value="createdAt_asc">📅 Registration Date (Oldest First)</SelectItem>
                <SelectItem value="name_asc">👤 Name / Email (A → Z)</SelectItem>
                <SelectItem value="name_desc">👤 Name / Email (Z → A)</SelectItem>
                <SelectItem value="storeName_asc">🏪 Store / Business Name (A → Z)</SelectItem>
                <SelectItem value="storeName_desc">🏪 Store / Business Name (Z → A)</SelectItem>
                {sellerTypeOptions && (
                  <SelectItem value="sellerType_asc">🏷️ Seller Category Type (A → Z)</SelectItem>
                )}
                <SelectItem value="status_asc">✅ Status (Approved First)</SelectItem>
                <SelectItem value="status_desc">⏳ Status (Pending First)</SelectItem>
                <SelectItem value="subscriptionPlan_asc">💳 Subscription Plan (A → Z)</SelectItem>
                <SelectItem value="commissionRate_desc">💰 Commission Rate (Highest First)</SelectItem>
                <SelectItem value="commissionRate_asc">💰 Commission Rate (Lowest First)</SelectItem>
                <SelectItem value="docStatus_asc">📄 Documents (Complete First)</SelectItem>
                <SelectItem value="docStatus_desc">⚠️ Documents (Incomplete First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Counter and Reset */}
        <div className="flex items-center gap-2.5 ml-auto">
          {typeof totalCount === "number" && (
            <Badge variant="secondary" className="font-bold text-xs px-3 py-1 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/50">
              {loading ? "Loading..." : `${totalCount} ${totalCount === 1 ? "seller" : "sellers"}`}
            </Badge>
          )}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8.5 px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors gap-1.5 font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
