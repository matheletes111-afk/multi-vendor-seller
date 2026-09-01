"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/ui/checkbox-v2"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Ban,
  Clock,
  Building2,
  UtensilsCrossed,
  Package,
  Wrench,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Store,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Eye,
  Check,
  Sparkles,
  AlertTriangle,
  Info,
  DollarSign,
  Percent,
} from "lucide-react"
import { SellerDetailsView } from "@/components/admin/sellers/seller-details-view"
import { HotelSellerDetailsView } from "@/components/admin/sellers/hotel-seller-details-view"
import { RestaurantSellerDetailsView } from "@/components/admin/sellers/restaurant-seller-details-view"
import { SellerFilterToolbar } from "@/components/admin/sellers/seller-filter-toolbar"
import { SellerDocumentBadge } from "@/components/admin/sellers/seller-document-badge"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import type { UnifiedSellerItem } from "@/app/api/admin/all-sellers/route"

export function AllSellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const searchQ = searchParams.get("search") ?? ""
  const sellerTypeParam = (searchParams.get("sellerType") || searchParams.get("type") || "ALL").toUpperCase()
  const statusParam = (searchParams.get("status") || "ALL").toUpperCase()
  const timeframeParam = searchParams.get("timeframe") ?? "all"
  const specificDateParam = searchParams.get("specificDate") ?? ""
  const startParam = searchParams.get("startDate") ?? ""
  const endParam = searchParams.get("endDate") ?? ""
  const docStatusParam = (searchParams.get("docStatus") || "ALL").toUpperCase()
  const sortByParam = searchParams.get("sortBy") ?? "createdAt"
  const sortOrderParam = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc"

  // Local filter states
  const [searchInput, setSearchInput] = useState(searchQ)
  const [localType, setLocalType] = useState(sellerTypeParam)
  const [localStatus, setLocalStatus] = useState(statusParam)
  const [localTimeframe, setLocalTimeframe] = useState(timeframeParam)
  const [localSpecificDate, setLocalSpecificDate] = useState(specificDateParam)
  const [startDate, setStartDate] = useState(startParam)
  const [endDate, setEndDate] = useState(endParam)
  const [localDocStatus, setLocalDocStatus] = useState(docStatusParam)
  const [localSortBy, setLocalSortBy] = useState(sortByParam)
  const [localSortOrder, setLocalSortOrder] = useState<"asc" | "desc">(sortOrderParam)

  // Data states
  const [data, setData] = useState<{
    sellers: UnifiedSellerItem[]
    totalCount: number
    totalPages: number
    page: number
    perPage: number
    stats: {
      totalAll: number
      totalProduct: number
      totalService: number
      totalHotel: number
      totalRestaurant: number
      totalPending: number
      totalSuspended: number
      totalApproved: number
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Selection state
  const [selectedMap, setSelectedMap] = useState<Map<string, UnifiedSellerItem>>(new Map())

  // Expanded row state
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

  // Modal dialog states
  const [bulkActionType, setBulkActionType] = useState<"approve" | "suspend" | "unsuspend" | null>(null)
  const [bulkFeedback, setBulkFeedback] = useState("")
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [bulkResultModal, setBulkResultModal] = useState<{
    open: boolean
    action: string
    succeeded: number
    failed: number
    results: Array<{ id: string; type: string; name?: string; success: boolean; error?: string }>
  } | null>(null)

  // Single item action dialogs
  const [correctionTarget, setCorrectionTarget] = useState<UnifiedSellerItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<UnifiedSellerItem | null>(null)
  const [feedbackText, setFeedbackText] = useState("")

  // Commission Dialog state
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionTarget, setCommissionTarget] = useState<UnifiedSellerItem | null>(null)
  const [commissionValue, setCommissionValue] = useState<number | "">("")

  // Update URL helper with full param persistence
  const updateUrlParams = useCallback((newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams(searchParams.toString())
    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== "ALL" && val !== "all") {
        current.set(key, val)
      } else {
        current.delete(key)
      }
    })
    router.push(`/admin/all-sellers?${current.toString()}`)
  }, [router, searchParams])

  // Fetch sellers
  const loadSellers = useCallback((showLoader = true) => {
    if (showLoader) {
      setLoading(true)
      setError(null)
    }

    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (searchQ) params.set("search", searchQ)
    if (sellerTypeParam !== "ALL") params.set("sellerType", sellerTypeParam)
    if (statusParam !== "ALL") params.set("status", statusParam)
    if (timeframeParam !== "all") params.set("timeframe", timeframeParam)
    if (specificDateParam) params.set("specificDate", specificDateParam)
    if (startParam) params.set("startDate", startParam)
    if (endParam) params.set("endDate", endParam)
    if (docStatusParam !== "ALL") params.set("docStatus", docStatusParam)
    if (sortByParam) params.set("sortBy", sortByParam)
    if (sortOrderParam) params.set("sortOrder", sortOrderParam)

    fetch(`/api/admin/all-sellers?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch all sellers directory")
        return res.json()
      })
      .then((json) => {
        setData(json)
      })
      .catch((err) => {
        setError(err.message || "Failed to load sellers")
      })
      .finally(() => {
        if (showLoader) setLoading(false)
      })
  }, [page, perPage, searchQ, sellerTypeParam, statusParam, timeframeParam, specificDateParam, startParam, endParam, docStatusParam, sortByParam, sortOrderParam])

  useEffect(() => {
    loadSellers()
    setSelectedMap(new Map())
  }, [loadSellers])

  useEffect(() => {
    setSearchInput(searchQ)
    setLocalType(sellerTypeParam)
    setLocalStatus(statusParam)
    setLocalTimeframe(timeframeParam)
    setLocalSpecificDate(specificDateParam)
    setStartDate(startParam)
    setEndDate(endParam)
    setLocalDocStatus(docStatusParam)
    setLocalSortBy(sortByParam)
    setLocalSortOrder(sortOrderParam)
  }, [searchQ, sellerTypeParam, statusParam, timeframeParam, specificDateParam, startParam, endParam, docStatusParam, sortByParam, sortOrderParam])

  // Sorting handler
  const handleSort = (field: string) => {
    const newOrder = localSortBy === field && localSortOrder === "asc" ? "desc" : "asc"
    setLocalSortBy(field)
    setLocalSortOrder(newOrder)
    updateUrlParams({
      page: "1",
      sortBy: field,
      sortOrder: newOrder,
    })
  }

  // Apply filters
  const handleApplyFilters = (overrideSearch?: string) => {
    const effectiveSearch = typeof overrideSearch === "string" ? overrideSearch : searchInput
    updateUrlParams({
      page: "1",
      search: effectiveSearch.trim() || undefined,
      sellerType: localType,
      status: localStatus,
      timeframe: localTimeframe,
      specificDate: localSpecificDate || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      docStatus: localDocStatus,
      sortBy: localSortBy,
      sortOrder: localSortOrder,
    })
  }

  // Reset filters
  const handleResetFilters = () => {
    setSearchInput("")
    setLocalType("ALL")
    setLocalStatus("ALL")
    setLocalTimeframe("all")
    setLocalSpecificDate("")
    setStartDate("")
    setEndDate("")
    setLocalDocStatus("ALL")
    setLocalSortBy("createdAt")
    setLocalSortOrder("desc")
    router.push(`/admin/all-sellers`)
  }


  // Selection handlers
  const handleToggleSelectOne = (seller: UnifiedSellerItem) => {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (next.has(seller.id)) {
        next.delete(seller.id)
      } else {
        next.set(seller.id, seller)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (!data?.sellers) return
    const allOnPageSelected = data.sellers.length > 0 && data.sellers.every((s) => selectedMap.has(s.id))

    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (allOnPageSelected) {
        data.sellers.forEach((s) => next.delete(s.id))
      } else {
        data.sellers.forEach((s) => next.set(s.id, s))
      }
      return next
    })
  }

  const handleDeselectAll = () => {
    setSelectedMap(new Map())
  }

  // Single actions
  const executeSingleStatusAction = async (
    seller: UnifiedSellerItem,
    action: "approve" | "suspend" | "unsuspend" | "reject" | "correction",
    feedback?: string
  ) => {
    setActionLoading(seller.id)
    setError(null)
    try {
      const res = await fetch("/api/admin/all-sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sellers: [{ id: seller.id, type: seller.sellerType }],
          feedback,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const errMsg = json.results?.[0]?.error || json.error || "Failed to update seller"
        setError(errMsg)
      } else {
        loadSellers(false)
      }
    } catch (err: any) {
      setError(err?.message || "Operation failed")
    } finally {
      setActionLoading(null)
      setCorrectionTarget(null)
      setRejectTarget(null)
      setFeedbackText("")
    }
  }

  // Update commission handler
  const handleUpdateCommission = async (target: UnifiedSellerItem, rate: number | null) => {
    setActionLoading(target.id)
    try {
      let endpoint = ""
      if (target.sellerType === "HOTEL") {
        endpoint = `/api/admin/hotel-sellers/${target.id}/commission`
      } else if (target.sellerType === "RESTAURANT") {
        endpoint = `/api/admin/restaurant-sellers/${target.id}/commission`
      } else {
        endpoint = `/api/admin/sellers/${target.id}/commission`
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update commission rate")
      await loadSellers(false)
      setIsCommissionDialogOpen(false)
      setCommissionTarget(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Bulk actions
  const handleExecuteBulkAction = async () => {
    if (!bulkActionType || selectedMap.size === 0) return
    setIsBulkProcessing(true)
    setError(null)

    const sellersList = Array.from(selectedMap.values()).map((s) => ({
      id: s.id,
      type: s.sellerType,
    }))

    try {
      const res = await fetch("/api/admin/all-sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkActionType,
          sellers: sellersList,
          feedback: bulkFeedback.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok && !json.results) {
        throw new Error(json.error || "Bulk action request failed")
      }

      setBulkResultModal({
        open: true,
        action: bulkActionType,
        succeeded: json.succeeded ?? 0,
        failed: json.failed ?? 0,
        results: json.results || [],
      })

      setSelectedMap(new Map())
      setBulkActionType(null)
      setBulkFeedback("")
      loadSellers(false)
    } catch (err: any) {
      setError(err?.message || "Failed to execute bulk action")
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const allOnPageSelected =
    data?.sellers && data.sellers.length > 0 && data.sellers.every((s) => selectedMap.has(s.id))

  const selectedCount = selectedMap.size

  // Helper for generating dedicated seller details page URL
  const getSellerDetailUrl = (seller: UnifiedSellerItem) => {
    if (seller.sellerType === "PRODUCT" || seller.sellerType === "SERVICE") {
      return `/admin/sellers/${seller.id}`
    }
    if (seller.sellerType === "HOTEL") {
      return `/admin/hotel-sellers/${seller.id}`
    }
    return `/admin/restaurant-sellers/${seller.id}`
  }

  // Helper for Type Badges
  const renderTypeBadge = (type: UnifiedSellerItem["sellerType"]) => {
    switch (type) {
      case "PRODUCT":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:bg-blue-900/40 hover:bg-blue-500/20 border-blue-200 dark:border-blue-800 gap-1.5 px-2.5 py-0.5 rounded-full font-medium">
            <Package className="h-3 w-3" />
            Product Seller
          </Badge>
        )
      case "SERVICE":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 dark:bg-purple-900/40 hover:bg-purple-500/20 border-purple-200 dark:border-purple-800 gap-1.5 px-2.5 py-0.5 rounded-full font-medium">
            <Wrench className="h-3 w-3" />
            Service Seller
          </Badge>
        )
      case "HOTEL":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-900/40 hover:bg-emerald-500/20 border-emerald-200 dark:border-emerald-800 gap-1.5 px-2.5 py-0.5 rounded-full font-medium">
            <Building2 className="h-3 w-3" />
            Hotel Seller
          </Badge>
        )
      case "RESTAURANT":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-900/40 hover:bg-amber-500/20 border-amber-200 dark:border-amber-800 gap-1.5 px-2.5 py-0.5 rounded-full font-medium">
            <UtensilsCrossed className="h-3 w-3" />
            Restaurant Seller
          </Badge>
        )
    }
  }

  // Helper for Status Badges
  const renderStatusBadge = (seller: UnifiedSellerItem) => {
    if (seller.isSuspended) {
      return (
        <Badge variant="destructive" className="gap-1 rounded-full px-2.5 py-0.5">
          <Ban className="h-3 w-3" /> Suspended
        </Badge>
      )
    }
    if (seller.status === "REJECTED") {
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1 rounded-full px-2.5 py-0.5">
          <X className="h-3 w-3" /> Rejected
        </Badge>
      )
    }
    if (seller.status === "CORRECTION_NEEDED") {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1 rounded-full px-2.5 py-0.5">
          <AlertCircle className="h-3 w-3" /> Correction Needed
        </Badge>
      )
    }
    if (seller.isApproved) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-full px-2.5 py-0.5 shadow-sm">
          <ShieldCheck className="h-3 w-3" /> Approved
        </Badge>
      )
    }
    if (!seller.onboardingCompleted) {
      return (
        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 gap-1 rounded-full px-2.5 py-0.5">
          <Clock className="h-3 w-3" /> Onboarding (Step {seller.onboardingStep}/6)
        </Badge>
      )
    }
    return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 rounded-full px-2.5 py-0.5">
        <Clock className="h-3 w-3" /> Pending Review
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-3 sm:p-5 lg:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                All 4 Sellers Master
                <Badge variant="secondary" className="text-[11px] font-semibold rounded-full px-2 py-0.5">
                  Master Directory
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Unified management, search, and bulk operations across Product, Service, Hotel, and Restaurant sellers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSellers()}
            disabled={loading}
            className="rounded-2xl h-9.5 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-medium text-xs sm:text-sm"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
        {/* Total All */}
        <Card
          onClick={() => {
            setLocalType("ALL")
            setLocalStatus("ALL")
            router.push("/admin/all-sellers")
          }}
          className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-md rounded-2xl bg-white dark:bg-slate-900 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">All Sellers</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {data?.stats?.totalAll ?? "—"}
              </span>
              <Users className="h-4 w-4 text-blue-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Product Sellers */}
        <Card
          onClick={() => {
            setLocalType("PRODUCT")
            const params = new URLSearchParams()
            params.set("sellerType", "PRODUCT")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-md rounded-2xl bg-white dark:bg-slate-900 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider truncate">Products</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {data?.stats?.totalProduct ?? "—"}
              </span>
              <Package className="h-4 w-4 text-blue-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Service Sellers */}
        <Card
          onClick={() => {
            setLocalType("SERVICE")
            const params = new URLSearchParams()
            params.set("sellerType", "SERVICE")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-purple-500/50 transition-all hover:shadow-md rounded-2xl bg-white dark:bg-slate-900 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">Services</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {data?.stats?.totalService ?? "—"}
              </span>
              <Wrench className="h-4 w-4 text-purple-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Hotel Sellers */}
        <Card
          onClick={() => {
            setLocalType("HOTEL")
            const params = new URLSearchParams()
            params.set("sellerType", "HOTEL")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all hover:shadow-md rounded-2xl bg-white dark:bg-slate-900 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">Hotels</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {data?.stats?.totalHotel ?? "—"}
              </span>
              <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Sellers */}
        <Card
          onClick={() => {
            setLocalType("RESTAURANT")
            const params = new URLSearchParams()
            params.set("sellerType", "RESTAURANT")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-slate-200 dark:border-slate-800 hover:border-amber-500/50 transition-all hover:shadow-md rounded-2xl bg-white dark:bg-slate-900 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">Restaurants</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {data?.stats?.totalRestaurant ?? "—"}
              </span>
              <UtensilsCrossed className="h-4 w-4 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Review */}
        <Card
          onClick={() => {
            setLocalStatus("PENDING")
            const params = new URLSearchParams()
            params.set("status", "PENDING")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-amber-200 dark:border-amber-900/50 hover:border-amber-500 transition-all hover:shadow-md rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider truncate">Pending Review</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
                {data?.stats?.totalPending ?? "—"}
              </span>
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Suspended */}
        <Card
          onClick={() => {
            setLocalStatus("SUSPENDED")
            const params = new URLSearchParams()
            params.set("status", "SUSPENDED")
            router.push(`/admin/all-sellers?${params.toString()}`)
          }}
          className="cursor-pointer border-rose-200 dark:border-rose-900/50 hover:border-rose-500 transition-all hover:shadow-md rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 min-w-0"
        >
          <CardContent className="p-3 sm:p-4 space-y-0.5">
            <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider truncate">Suspended</p>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
                {data?.stats?.totalSuspended ?? "—"}
              </span>
              <Ban className="h-4 w-4 text-rose-600 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-none shadow-md bg-destructive/10 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* ── Enhanced Filter Toolbar ── */}
      <SellerFilterToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleApplyFilters}
        timeframe={localTimeframe}
        onTimeframeChange={(tf) => {
          setLocalTimeframe(tf)
          updateUrlParams({
            page: "1",
            timeframe: tf,
            specificDate: tf === "specific" ? localSpecificDate : undefined,
            startDate: tf === "custom" ? startDate : undefined,
            endDate: tf === "custom" ? endDate : undefined,
          })
        }}
        specificDate={localSpecificDate}
        onSpecificDateChange={(d) => {
          setLocalSpecificDate(d)
          updateUrlParams({ page: "1", timeframe: "specific", specificDate: d })
        }}
        startDate={startDate}
        onStartDateChange={(sd) => {
          setStartDate(sd)
          updateUrlParams({ page: "1", timeframe: "custom", startDate: sd, endDate })
        }}
        endDate={endDate}
        onEndDateChange={(ed) => {
          setEndDate(ed)
          updateUrlParams({ page: "1", timeframe: "custom", startDate, endDate: ed })
        }}
        docStatus={localDocStatus}
        onDocStatusChange={(ds) => {
          setLocalDocStatus(ds)
          updateUrlParams({ page: "1", docStatus: ds })
        }}
        status={localStatus}
        onStatusChange={(st) => {
          setLocalStatus(st)
          updateUrlParams({ page: "1", status: st })
        }}
        sellerType={localType}
        onSellerTypeChange={(t) => {
          setLocalType(t)
          updateUrlParams({ page: "1", sellerType: t })
        }}
        sellerTypeOptions={[
          { value: "ALL", label: "All 4 Types", icon: <Users className="h-3.5 w-3.5" /> },
          { value: "PRODUCT", label: "Products", icon: <Package className="h-3.5 w-3.5" /> },
          { value: "SERVICE", label: "Services", icon: <Wrench className="h-3.5 w-3.5" /> },
          { value: "HOTEL", label: "Hotels", icon: <Building2 className="h-3.5 w-3.5" /> },
          { value: "RESTAURANT", label: "Restaurants", icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
        ]}
        sortBy={localSortBy}
        onSortByChange={(sb) => {
          setLocalSortBy(sb)
          updateUrlParams({ page: "1", sortBy: sb })
        }}
        sortOrder={localSortOrder}
        onSortOrderChange={(so) => {
          setLocalSortOrder(so)
          updateUrlParams({ page: "1", sortOrder: so })
        }}
        onReset={handleResetFilters}
        totalCount={data?.totalCount}
        loading={loading}
      />

      {/* ── Bulk Actions Floating Toolbar ── */}
      {selectedCount > 0 && (
        <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white rounded-3xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 font-bold text-xs">
              {selectedCount} Selected
            </Badge>
            <p className="text-xs sm:text-sm font-medium text-slate-300 hidden sm:block">
              Ready for bulk operations across selected seller types
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              className="h-9 px-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
            >
              Deselect All
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkActionType("approve")}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/30 gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Bulk Approve
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkActionType("suspend")}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-600/30 gap-1.5"
            >
              <Ban className="h-4 w-4" /> Bulk Suspend
            </Button>

            <Button
              size="sm"
              onClick={() => setBulkActionType("unsuspend")}
              className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/30 gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" /> Bulk Reactivate
            </Button>
          </div>
        </div>
      )}

      {/* ── Master Sellers Table Card ── */}
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Master Sellers Directory
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {data?.sellers?.length || 0} of {data?.totalCount || 0} registered sellers across all 4 categories
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Per page:</span>
            <Select
              value={perPage.toString()}
              onValueChange={(val) => {
                const params = new URLSearchParams(searchParams.toString())
                params.set("perPage", val)
                params.set("page", "1")
                router.push(`/admin/all-sellers?${params.toString()}`)
              }}
            >
              <SelectTrigger className="h-8 w-20 rounded-xl border-slate-200 dark:border-slate-800 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-24">
              <PageLoader message="Loading master sellers directory..." />
            </div>
          ) : data?.sellers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No sellers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                No seller records match your current filter and search criteria. Try resetting filters.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="rounded-xl">
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-950/50">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="w-12 pl-6">
                      <Checkbox
                        checked={!!allOnPageSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all sellers on current page"
                      />
                    </TableHead>
                    <TableHead className="min-w-[220px]">Seller / Business</TableHead>
                    <TableHead className="min-w-[130px]">Type</TableHead>
                    <TableHead className="min-w-[180px]">Contact & Location</TableHead>
                    <TableHead className="min-w-[110px]">Plan</TableHead>
                    <TableHead className="min-w-[120px]">Commission</TableHead>
                    <TableHead className="min-w-[140px]">Documents</TableHead>
                    <TableHead className="min-w-[130px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Referred By</TableHead>
                    <TableHead className="min-w-[120px]">Joined Date</TableHead>
                    <TableHead className="text-right pr-6 min-w-[130px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {data?.sellers?.map((seller) => {
                    const isSelected = selectedMap.has(seller.id)
                    const isExpanded = expandedSellerId === seller.id
                    const displayName = seller.businessName || seller.userName || "Unnamed Seller"
                    const initials = displayName.slice(0, 2).toUpperCase()

                    return (
                      <React.Fragment key={seller.id}>
                        <TableRow
                          className={cn(
                            "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800",
                            isSelected && "bg-blue-50/40 dark:bg-blue-950/20",
                            isExpanded && "bg-slate-50 dark:bg-slate-800/60"
                          )}
                        >
                          {/* Checkbox */}
                          <TableCell className="pl-6">
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(seller)}
                              aria-label={`Select ${displayName}`}
                            />
                          </TableCell>

                          {/* Seller / Business */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-slate-800">
                                {seller.logo ? (
                                   <AvatarImage src={seller.logo} alt={displayName} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-0.5 min-w-0">
                                <Link
                                  href={getSellerDetailUrl(seller)}
                                  target="_blank"
                                  className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline inline-flex items-center gap-1 leading-tight group truncate max-w-[200px]"
                                  title="View full seller profile & details"
                                >
                                  <span className="truncate">{displayName}</span>
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 shrink-0" />
                                </Link>
                                {seller.userName && seller.userName !== seller.businessName && (
                                  <p className="text-xs text-slate-500 font-medium truncate max-w-[180px]">{seller.userName}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Category Type */}
                          <TableCell>{renderTypeBadge(seller.sellerType)}</TableCell>

                          {/* Contact & Location */}
                          <TableCell>
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {seller.userEmail && (
                                <div className="flex items-center gap-1.5 truncate max-w-[170px]" title={seller.userEmail}>
                                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{seller.userEmail}</span>
                                </div>
                              )}
                              {seller.userPhone && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{seller.userPhone}</span>
                                </div>
                              )}
                              {(seller.city || seller.state) && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[160px]">{[seller.city, seller.state].filter(Boolean).join(", ")}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Subscription Plan */}
                          <TableCell>
                            {seller.subscriptionPlan ? (
                              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
                                {seller.subscriptionPlan}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">Free</span>
                            )}
                          </TableCell>

                          {/* Commission Rate */}
                          <TableCell>
                            {seller.commissionRate != null ? (
                              <div
                                className="cursor-pointer inline-flex items-center gap-1 group/comm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCommissionTarget(seller)
                                  setCommissionValue(seller.commissionRate ?? "")
                                  setIsCommissionDialogOpen(true)
                                }}
                                title="Click to edit custom commission rate"
                              >
                                <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-lg px-2 py-0.5 font-bold text-xs group-hover/comm:bg-purple-600 group-hover/comm:text-white transition-colors cursor-pointer">
                                  {seller.commissionRate}%
                                </Badge>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2.5 text-[11px] font-semibold text-purple-700 bg-purple-50/70 border-purple-200/80 hover:bg-purple-100 hover:text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 rounded-lg cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCommissionTarget(seller)
                                  setCommissionValue("")
                                  setIsCommissionDialogOpen(true)
                                }}
                              >
                                Assign
                              </Button>
                            )}
                          </TableCell>

                          {/* Document Status */}
                          <TableCell>
                            <SellerDocumentBadge evaluation={seller.documentEvaluation} />
                          </TableCell>

                          {/* Status */}
                          <TableCell>{renderStatusBadge(seller)}</TableCell>

                          {/* Referred By */}
                          <TableCell>
                            {seller.referredBy ? (
                              <Badge
                                variant="outline"
                                className="text-xs font-medium px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 max-w-[160px] truncate inline-block"
                                title={seller.referredBy}
                              >
                                {seller.referredBy}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                          </TableCell>

                          {/* Registered Date */}
                          <TableCell className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {new Date(seller.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link href={getSellerDetailUrl(seller)} target="_blank">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 rounded-xl text-xs gap-1 font-semibold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 shadow-sm"
                                  title="Open Dedicated Seller Details Page"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Details</span>
                                  <ExternalLink className="h-3 w-3 opacity-70" />
                                </Button>
                              </Link>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
                                className="h-8 px-2 rounded-xl text-xs gap-1 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                title="Toggle quick preview"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* ── Expanded Detail View ── */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={11} className="p-6">
                              <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                      <Info className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                        Comprehensive Profile & KYC Review
                                      </h4>
                                      <p className="text-xs text-slate-500">
                                        Verify submitted credentials, business documents, banking info, and manage approval status.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link href={getSellerDetailUrl(seller)} target="_blank">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 rounded-xl text-xs gap-1.5 font-semibold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 shadow-sm"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" /> Open Full Details Page
                                      </Button>
                                    </Link>

                                    {!seller.isApproved && (
                                      <Button
                                        size="sm"
                                        disabled={actionLoading === seller.id || seller.documentEvaluation?.isComplete === false}
                                        onClick={() => executeSingleStatusAction(seller, "approve")}
                                        className={cn(
                                          "h-8 px-3 rounded-xl font-semibold text-xs shadow-sm gap-1 transition-all",
                                          seller.documentEvaluation?.isComplete === false
                                            ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed shadow-none"
                                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                        )}
                                        title={
                                          seller.documentEvaluation?.isComplete === false
                                            ? `Cannot approve: ${seller.documentEvaluation.missingCount} required documents are missing (${seller.documentEvaluation.missingDocuments.join(", ")})`
                                            : "Approve Seller"
                                        }
                                      >
                                        <Check className="h-3.5 w-3.5" /> Approve Seller
                                      </Button>
                                    )}

                                    {!seller.isSuspended ? (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={actionLoading === seller.id}
                                        onClick={() => executeSingleStatusAction(seller, "suspend")}
                                        className="h-8 px-3 rounded-xl font-semibold text-xs shadow-sm gap-1"
                                      >
                                        <Ban className="h-3.5 w-3.5" /> Suspend
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={actionLoading === seller.id}
                                        onClick={() => executeSingleStatusAction(seller, "unsuspend")}
                                        className="h-8 px-3 rounded-xl font-semibold text-xs border-blue-200 text-blue-700 hover:bg-blue-50 gap-1"
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5" /> Reactivate
                                      </Button>
                                    )}

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setCorrectionTarget(seller)
                                        setFeedbackText(seller.adminFeedback || "")
                                      }}
                                      className="h-8 px-3 rounded-xl text-xs font-medium"
                                    >
                                      Request Correction
                                    </Button>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setRejectTarget(seller)
                                        setFeedbackText(seller.adminFeedback || "")
                                      }}
                                      className="h-8 px-3 rounded-xl text-xs text-rose-600 hover:bg-rose-50 border-rose-200 font-medium"
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                </div>

                                {/* Render specialized detail components */}
                                {seller.sellerType === "PRODUCT" || seller.sellerType === "SERVICE" ? (
                                  <SellerDetailsView
                                    seller={seller.raw}
                                    actionLoading={actionLoading}
                                    onApprove={() => executeSingleStatusAction(seller, "approve")}
                                    onSuspend={() => executeSingleStatusAction(seller, "suspend")}
                                    onUnsuspend={() => executeSingleStatusAction(seller, "unsuspend")}
                                    onOpenCorrection={() => {
                                      setCorrectionTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                    onOpenReject={() => {
                                      setRejectTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                  />
                                ) : seller.sellerType === "HOTEL" ? (
                                  <HotelSellerDetailsView
                                    seller={seller.raw}
                                    actionLoading={actionLoading}
                                    onApprove={() => executeSingleStatusAction(seller, "approve")}
                                    onSuspend={() => executeSingleStatusAction(seller, "suspend")}
                                    onUnsuspend={() => executeSingleStatusAction(seller, "unsuspend")}
                                    onOpenCorrection={() => {
                                      setCorrectionTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                    onOpenReject={() => {
                                      setRejectTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                  />
                                ) : (
                                  <RestaurantSellerDetailsView
                                    seller={seller.raw}
                                    actionLoading={actionLoading}
                                    onApprove={() => executeSingleStatusAction(seller, "approve")}
                                    onSuspend={() => executeSingleStatusAction(seller, "suspend")}
                                    onUnsuspend={() => executeSingleStatusAction(seller, "unsuspend")}
                                    onOpenCorrection={() => {
                                      setCorrectionTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                    onOpenReject={() => {
                                      setRejectTarget(seller)
                                      setFeedbackText(seller.adminFeedback || "")
                                    }}
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <AdminPagination
                basePath="/admin/all-sellers"
                currentPage={page}
                totalPages={data.totalPages}
                totalCount={data.totalCount}
                pageSize={perPage}
                params={searchParams}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bulk Confirmation Dialog ── */}
      <Dialog open={bulkActionType !== null} onOpenChange={(open) => !open && setBulkActionType(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {bulkActionType === "approve" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Bulk Approve {selectedCount} Sellers
                </>
              )}
              {bulkActionType === "suspend" && (
                <>
                  <Ban className="h-5 w-5 text-rose-600" />
                  Bulk Suspend {selectedCount} Sellers
                </>
              )}
              {bulkActionType === "unsuspend" && (
                <>
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Bulk Reactivate {selectedCount} Sellers
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {bulkActionType === "approve" &&
                `You are about to approve ${selectedCount} selected sellers across all 4 categories. Incomplete profiles will be flagged with validation feedback.`}
              {bulkActionType === "suspend" &&
                `You are about to suspend ${selectedCount} selected sellers. Their listings and services will be hidden from the marketplace.`}
              {bulkActionType === "unsuspend" &&
                `You are about to reactivate ${selectedCount} selected sellers. Their access and listings will be restored.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {bulkActionType === "approve" && (() => {
              const incompleteSelected = Array.from(selectedMap.values()).filter((s) => s.documentEvaluation?.isComplete === false)
              if (incompleteSelected.length === 0) return null
              return (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{incompleteSelected.length} of {selectedCount} selected sellers have missing documents</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Sellers with incomplete documents cannot be approved and will fail validation.
                  </p>
                </div>
              )
            })()}

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs">
              {Array.from(selectedMap.values()).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-800 last:border-none">
                  <div className="flex flex-col truncate max-w-[220px]">
                    <span className="font-medium truncate">
                      {s.businessName || s.userName || "Seller"}
                    </span>
                    {s.documentEvaluation?.isComplete === false && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold truncate">
                        ⚠️ {s.documentEvaluation.missingCount} doc(s) missing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.documentEvaluation?.isComplete === false ? (
                      <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                        Incomplete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Docs Ready
                      </Badge>
                    )}
                    {renderTypeBadge(s.sellerType)}
                  </div>
                </div>
              ))}
            </div>

            {bulkActionType === "suspend" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason for Suspension (Optional email note)</Label>
                <Textarea
                  placeholder="Enter reason or policy citation for the suspension..."
                  className="rounded-xl text-xs min-h-[80px]"
                  value={bulkFeedback}
                  onChange={(e) => setBulkFeedback(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkActionType(null)}
              disabled={isBulkProcessing}
              className="rounded-2xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteBulkAction}
              disabled={isBulkProcessing}
              className={cn(
                "rounded-2xl text-xs font-bold text-white shadow-md",
                bulkActionType === "approve" && "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20",
                bulkActionType === "suspend" && "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
                bulkActionType === "unsuspend" && "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
              )}
            >
              {isBulkProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> Processing...
                </>
              ) : (
                `Confirm Bulk ${bulkActionType?.toUpperCase()}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Execution Results Modal ── */}
      {bulkResultModal && (
        <Dialog open={bulkResultModal.open} onOpenChange={(open) => !open && setBulkResultModal(null)}>
          <DialogContent className="rounded-3xl max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                {bulkResultModal.failed === 0 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Bulk Action Completed Successfully
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Bulk Action Completed with Warnings
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Processed {bulkResultModal.succeeded + bulkResultModal.failed} sellers: {bulkResultModal.succeeded} succeeded, {bulkResultModal.failed} failed.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-60 overflow-y-auto space-y-2 py-2">
              {bulkResultModal.results.map((res, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-2xl border text-xs space-y-1",
                    res.success
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                      : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                  )}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{res.name || res.id}</span>
                    <Badge variant={res.success ? "default" : "destructive"} className="text-[10px] px-2 py-0">
                      {res.success ? "Succeeded" : "Failed"}
                    </Badge>
                  </div>
                  {res.error && (
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] leading-tight">
                      {res.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button onClick={() => setBulkResultModal(null)} className="rounded-2xl text-xs font-bold w-full">
                Close & Review Table
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Correction Request Dialog ── */}
      <Dialog open={correctionTarget !== null} onOpenChange={(open) => !open && setCorrectionTarget(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Request Correction / Missing Info
            </DialogTitle>
            <DialogDescription className="text-xs">
              Notify {correctionTarget?.businessName || correctionTarget?.userName || "the seller"} of what changes or documents are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Feedback / Instructions for Seller</Label>
            <Textarea
              placeholder="Specify missing documents, rejected ID photo, invalid tax info, etc..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="rounded-xl text-xs min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionTarget(null)} className="rounded-2xl text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => correctionTarget && executeSingleStatusAction(correctionTarget, "correction", feedbackText)}
              disabled={!feedbackText.trim()}
              className="rounded-2xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white"
            >
              Send Correction Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Seller Dialog ── */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <X className="h-5 w-5" />
              Reject Seller Application
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will mark the seller profile as rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Reason for Rejection</Label>
            <Textarea
              placeholder="State clear reasons why this seller application cannot be accepted..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="rounded-xl text-xs min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} className="rounded-2xl text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && executeSingleStatusAction(rejectTarget, "reject", feedbackText)}
              disabled={!feedbackText.trim()}
              className="rounded-2xl text-xs font-bold"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Commission Dialog ── */}
      <Dialog
        open={isCommissionDialogOpen}
        onOpenChange={(open) => {
          setIsCommissionDialogOpen(open)
          if (!open) setCommissionTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Set Custom Commission Rate
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {commissionTarget ? (
                    <span>
                      For <strong className="text-foreground">{commissionTarget.businessName || commissionTarget.userName || commissionTarget.userEmail}</strong> ({commissionTarget.sellerType.toLowerCase()})
                    </span>
                  ) : (
                    "Override the platform default commission rate for this seller."
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="commRate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Commission Percentage (%)
              </Label>
              <div className="relative">
                <Input
                  id="commRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="e.g. 12.5"
                  className="rounded-2xl text-sm pr-9 h-11"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none font-semibold text-xs">
                  %
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1">
              <p className="text-[11px] text-muted-foreground">
                💡 Leave empty to use platform default commission settings.
              </p>
              <p className="text-[11px] text-muted-foreground">
                📌 Custom rates take immediate effect on all new customer orders & bookings.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCommissionDialogOpen(false)
                setCommissionTarget(null)
              }}
              className="rounded-2xl text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              disabled={actionLoading === commissionTarget?.id}
              onClick={() => {
                if (commissionTarget) {
                  handleUpdateCommission(commissionTarget, commissionValue === "" ? null : Number(commissionValue))
                }
              }}
            >
              {actionLoading === commissionTarget?.id ? "Saving..." : "Save Commission Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
