"use client"

import React, { Fragment, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Badge } from "@/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { PageLoader } from "@/components/ui/page-loader"
import { Alert, AlertDescription } from "@/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"
import { 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Ban, 
  Eye, 
  Briefcase, 
  Search, 
  X, 
  Calendar, 
  Filter, 
  UtensilsCrossed, 
  ChevronDown, 
  ChevronUp, 
  Globe,
  ExternalLink,
  Percent,
  Mail,
  Phone,
  MapPin,
  Megaphone,
} from "lucide-react"
import { RestaurantSellerDetailsView } from "@/components/admin/sellers/restaurant-seller-details-view"
import { SellerFilterToolbar } from "@/components/admin/sellers/seller-filter-toolbar"
import { SellerDocumentBadge } from "@/components/admin/sellers/seller-document-badge"
import { SellerEmailModal, type SellerEmailTarget } from "@/components/admin/sellers/seller-email-modal"
import { OnboardingReminderWizardModal } from "@/components/admin/sellers/onboarding-reminder-wizard-modal"
import { BulkCustomEmailModal } from "@/components/admin/sellers/bulk-custom-email-modal"
import Link from "next/link"

export function RestaurantSellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"
  const searchQ = searchParams.get("search") ?? ""
  const statusParam = (searchParams.get("status") || tab).toUpperCase()
  const timeframeParam = searchParams.get("timeframe") ?? "all"
  const specificDateParam = searchParams.get("specificDate") ?? ""
  const startParam = searchParams.get("startDate") ?? ""
  const endParam = searchParams.get("endDate") ?? ""
  const docStatusParam = (searchParams.get("docStatus") || "ALL").toUpperCase()
  const sortByParam = searchParams.get("sortBy") ?? "createdAt"
  const sortOrderParam = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc"

  // Local state
  const [searchInput, setSearchInput] = useState(searchQ)
  const [startDate, setStartDate] = useState(startParam)
  const [endDate, setEndDate] = useState(endParam)
  const [localStatus, setLocalStatus] = useState(statusParam)
  const [localTimeframe, setLocalTimeframe] = useState(timeframeParam)
  const [localSpecificDate, setLocalSpecificDate] = useState(specificDateParam)
  const [localDocStatus, setLocalDocStatus] = useState(docStatusParam)
  const [localSortBy, setLocalSortBy] = useState(sortByParam)
  const [localSortOrder, setLocalSortOrder] = useState<"asc" | "desc">(sortOrderParam)

  const [plans, setPlans] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/admin/plans?type=RESTAURANT")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data)
      })
      .catch((err) => console.error("Error loading restaurant plans:", err))
  }, [])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; action: string }>({ open: false, id: "", action: "" })
  const [feedback, setFeedback] = useState("")
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionValue, setCommissionValue] = useState<number | "">("")
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null)

  // Email modal & onboarding reminder states
  const [emailModalTarget, setEmailModalTarget] = useState<SellerEmailTarget | null>(null)
  const [isOnboardingReminderOpen, setIsOnboardingReminderOpen] = useState(false)
  const [isBulkCustomEmailOpen, setIsBulkCustomEmailOpen] = useState(false)

  // URL updating helper
  const updateUrlParams = useCallback((newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams(searchParams.toString())
    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== "ALL" && val !== "all") {
        current.set(key, val)
      } else {
        current.delete(key)
      }
    })
    router.push(`/admin/restaurant-sellers?${current.toString()}`)
  }, [router, searchParams])

  const handleUpdateCommission = async (sellerId: string, rate: number | null) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/restaurant-sellers/${sellerId}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      loadSellers()
      setIsCommissionDialogOpen(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const loadSellers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("perPage", perPage.toString())
    if (searchQ) params.set("search", searchQ)
    if (statusParam !== "ALL" && statusParam !== "all") params.set("status", statusParam)
    if (timeframeParam !== "all") params.set("timeframe", timeframeParam)
    if (specificDateParam) params.set("specificDate", specificDateParam)
    if (startParam) params.set("startDate", startParam)
    if (endParam) params.set("endDate", endParam)
    if (docStatusParam !== "ALL") params.set("docStatus", docStatusParam)
    if (sortByParam) params.set("sortBy", sortByParam)
    if (sortOrderParam) params.set("sortOrder", sortOrderParam)

    fetch(`/api/admin/restaurant-sellers?${params.toString()}`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, perPage, searchQ, statusParam, timeframeParam, specificDateParam, startParam, endParam, docStatusParam, sortByParam, sortOrderParam])

  useEffect(() => {
    loadSellers()
  }, [loadSellers])

  useEffect(() => {
    setSearchInput(searchQ)
    setStartDate(startParam)
    setEndDate(endParam)
    setLocalStatus(statusParam)
    setLocalTimeframe(timeframeParam)
    setLocalSpecificDate(specificDateParam)
    setLocalDocStatus(docStatusParam)
    setLocalSortBy(sortByParam)
    setLocalSortOrder(sortOrderParam)
  }, [searchQ, startParam, endParam, statusParam, timeframeParam, specificDateParam, docStatusParam, sortByParam, sortOrderParam])

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

  const handleApplyFilters = (overrideSearch?: string) => {
    const effectiveSearch = typeof overrideSearch === "string" ? overrideSearch : searchInput
    updateUrlParams({
      page: "1",
      search: effectiveSearch.trim() || undefined,
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

  const handleClear = () => {
    setSearchInput("")
    setStartDate("")
    setEndDate("")
    setLocalStatus("ALL")
    setLocalTimeframe("all")
    setLocalSpecificDate("")
    setLocalDocStatus("ALL")
    setLocalSortBy("createdAt")
    setLocalSortOrder("desc")
    router.push("/admin/restaurant-sellers")
  }

  const handleStatusAction = async (id: string, action: string, fb?: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/restaurant-sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: fb })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update status")
      
      setRejectDialog({ open: false, id: "", action: "" })
      setFeedback("")
      loadSellers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  if (loading && !data) return <PageLoader message="Loading restaurant sellers..." />

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Restaurant Seller Management
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Approve, verify food licenses, and monitor culinary and takeaway partners.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOnboardingReminderOpen(true)}
            className="rounded-2xl h-9 px-3.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1.5 font-bold text-xs shadow-sm"
            title="Bulk remind restaurant partners with incomplete onboarding"
          >
            <Mail className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Send Reminders</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBulkCustomEmailOpen(true)}
            className="rounded-2xl h-9 px-3.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1.5 font-bold text-xs shadow-sm"
            title="Broadcast a custom email announcement to restaurant partners"
          >
            <Megaphone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Broadcast Email</span>
          </Button>
          <Badge variant="outline" className="px-3.5 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold shadow-sm text-xs">
            {data?.totalCount || 0} Total Partners
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-none shadow-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Enhanced Filter Toolbar */}
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
        onReset={handleClear}
        totalCount={data?.totalCount}
        loading={loading}
      />

      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-950/50">
                <TableRow className="border-slate-100 dark:border-slate-800">
                  <TableHead className="py-4 pl-6 min-w-[220px]">Restaurant / Business</TableHead>
                  <TableHead className="min-w-[190px]">Contact & Location</TableHead>
                  <TableHead className="min-w-[90px]">Plan</TableHead>
                  <TableHead className="min-w-[120px]">Commission</TableHead>
                  <TableHead className="min-w-[150px]">Status & Documents</TableHead>
                  <TableHead className="text-right pr-6 min-w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.sellers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-24">
                      <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-semibold text-sm text-muted-foreground">No restaurant partners identified</p>
                      <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your search filters.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.sellers?.map((seller: any) => {
                    const isExpanded = expandedRow === seller.id
                    const displayName = seller.businessInfo?.businessName || seller.user?.name || "Unnamed Restaurant"
                    const logo = seller.businessInfo?.logo || seller.foods?.[0]?.image
                    const initials = displayName.slice(0, 2).toUpperCase()
                    const location = [seller.businessInfo?.city, seller.businessInfo?.state].filter(Boolean).join(", ")

                    return (
                      <Fragment key={seller.id}>
                        <TableRow
                          className={cn(
                            "group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800",
                            isExpanded && "bg-slate-50 dark:bg-slate-800/60"
                          )}
                        >
                          {/* Restaurant / Business */}
                          <TableCell className="py-4 pl-6 font-medium min-w-[220px]">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 mt-0.5">
                                {logo ? (
                                  <AvatarImage src={logo} alt={displayName} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="rounded-2xl font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-1 min-w-0">
                                <div className="min-w-0">
                                  <Link
                                    href={`/admin/restaurant-sellers/${seller.id}`}
                                    className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 hover:underline inline-flex items-center gap-1 leading-tight group truncate max-w-[190px]"
                                    title="View full restaurant seller profile & details"
                                  >
                                    <span className="truncate">{displayName}</span>
                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 shrink-0" />
                                  </Link>
                                  {seller.user?.name && seller.user?.name !== displayName && (
                                    <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">{seller.user.name}</p>
                                  )}
                                </div>

                                {/* Joined Date */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium inline-flex items-center gap-1 whitespace-nowrap">
                                    <Calendar className="h-3 w-3 text-slate-400" />
                                    {new Date(seller.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Contact & Location */}
                          <TableCell className="min-w-[190px]">
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {seller.user?.email && (
                                <div className="flex items-center gap-1.5 truncate max-w-[180px]" title={seller.user.email}>
                                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{seller.user.email}</span>
                                </div>
                              )}
                              {seller.user?.phone && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span>{seller.user.phone}</span>
                                </div>
                              )}
                              {location && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[170px]">{location}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Subscription Plan */}
                          <TableCell className="min-w-[90px]">
                            {seller.subscription?.plan?.name ? (
                              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
                                {seller.subscription.plan.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Free</span>
                            )}
                          </TableCell>

                          {/* Commission Rate */}
                          <TableCell className="min-w-[120px]">
                            {seller.commissionRate != null ? (
                              <div
                                className="cursor-pointer inline-flex items-center gap-1 group/comm"
                                onClick={() => {
                                  setSelectedSellerId(seller.id)
                                  setCommissionValue(seller.commissionRate)
                                  setIsCommissionDialogOpen(true)
                                }}
                                title="Click to edit custom commission rate"
                              >
                                <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-lg px-2 py-0.5 font-bold text-xs group-hover/comm:bg-purple-600 group-hover/comm:text-white transition-colors">
                                  {seller.commissionRate}%
                                </Badge>
                                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                                  Custom
                                </span>
                              </div>
                            ) : (
                              (() => {
                                const baseRate = seller.baseCommissionRate ?? data?.baseCommission ?? 10
                                return (
                                  <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <Badge
                                      variant="secondary"
                                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      onClick={() => {
                                        setSelectedSellerId(seller.id)
                                        setCommissionValue("")
                                        setIsCommissionDialogOpen(true)
                                      }}
                                      title={`Default restaurant base commission set by admin: ${baseRate}% (Click to assign custom rate)`}
                                    >
                                      <span className="font-bold">{baseRate}%</span>
                                      <span className="text-[9px] text-muted-foreground ml-1 uppercase tracking-tight font-medium">Base</span>
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-[11px] font-semibold text-purple-700 bg-purple-50/70 border-purple-200/80 hover:bg-purple-100 hover:text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 rounded-lg cursor-pointer transition-colors"
                                      onClick={() => {
                                        setSelectedSellerId(seller.id)
                                        setCommissionValue("")
                                        setIsCommissionDialogOpen(true)
                                      }}
                                    >
                                      Assign
                                    </Button>
                                  </div>
                                )
                              })()
                            )}
                          </TableCell>

                          {/* Status & Documents */}
                          <TableCell className="min-w-[150px]">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1">
                                <Badge
                                  className={cn(
                                    "rounded-full text-[10px] font-semibold uppercase px-2 py-0.5",
                                    seller.isApproved ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                                  )}
                                >
                                  {seller.isApproved ? "Approved" : "Pending"}
                                </Badge>
                                {seller.isSuspended && (
                                  <Badge className="bg-rose-600 text-white rounded-full text-[10px] font-semibold uppercase px-2 py-0.5">
                                    Suspended
                                  </Badge>
                                )}
                              </div>
                              <SellerDocumentBadge evaluation={seller.documentEvaluation} />
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-6 min-w-[130px]">
                            <div className="flex justify-end items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setEmailModalTarget({
                                    id: seller.id,
                                    name: seller.user?.name,
                                    businessName: seller.businessInfo?.businessName,
                                    email: seller.user?.email,
                                    sellerType: "RESTAURANT",
                                  })
                                }
                                className="h-8 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold gap-1 transition-colors"
                                title="Send Direct Email to Restaurant Partner"
                              >
                                <Mail className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Email</span>
                              </Button>

                              <Link
                                href={`/admin/restaurant-sellers/${seller.id}`}
                                className="inline-flex items-center justify-center h-8 px-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold gap-1 transition-colors"
                                title="View Full Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View</span>
                              </Link>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                                onClick={() => toggleRow(seller.id)}
                                title="Toggle quick preview"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Accordion Review */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={6} className="p-6">
                              <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <RestaurantSellerDetailsView
                                  seller={{ ...seller, plans }}
                                  actionLoading={actionLoading}
                                  onApprove={id => handleStatusAction(id, "approve")}
                                  onSuspend={id => handleStatusAction(id, "suspend")}
                                  onUnsuspend={id => handleStatusAction(id, "unsuspend")}
                                  onSendEmail={id =>
                                    setEmailModalTarget({
                                      id,
                                      name: seller.user?.name,
                                      businessName: seller.businessInfo?.businessName,
                                      email: seller.user?.email,
                                      sellerType: "RESTAURANT",
                                    })
                                  }
                                  onOpenCorrection={id => setRejectDialog({ open: true, id, action: "correction" })}
                                  onOpenReject={id => setRejectDialog({ open: true, id, action: "reject" })}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <AdminPagination
                basePath="/admin/restaurant-sellers"
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

      {/* Feedback Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={val => !val && setRejectDialog({ open: false, id: "", action: "" })}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn(
                "p-2.5 rounded-2xl border",
                rejectDialog.action === "correction"
                  ? "bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/50"
                  : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50"
              )}>
                {rejectDialog.action === "correction" ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <X className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {rejectDialog.action === "correction" ? "Request Correction" : "Reject Application"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {rejectDialog.action === "correction"
                    ? "Inform the restaurant partner about missing or invalid documents to update."
                    : "Provide a reason why this restaurant seller application cannot be accepted."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-3 space-y-2">
             <Label className="text-xs font-semibold">
               {rejectDialog.action === "correction" ? "Correction Memo" : "Rejection Reason"}
             </Label>
             <Textarea
                placeholder={rejectDialog.action === "correction" ? "e.g. Please re-upload your Food Hygiene / Sanitation license with current expiry..." : "Reason for rejection..."}
                className="rounded-2xl min-h-[100px] text-xs"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
             />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
             <Button variant="outline" size="sm" className="rounded-2xl text-xs font-medium" onClick={() => setRejectDialog({ open: false, id: "", action: "" })}>Cancel</Button>
             <Button
               className={cn(
                 "rounded-2xl text-xs font-bold text-white",
                 rejectDialog.action === "correction" ? "bg-orange-600 hover:bg-orange-700" : "bg-rose-600 hover:bg-rose-700"
               )}
               size="sm"
               onClick={() => handleStatusAction(rejectDialog.id, rejectDialog.action, feedback)}
               disabled={!feedback.trim() || actionLoading === rejectDialog.id}
             >
               {rejectDialog.action === "correction" ? "Send Correction Request" : "Confirm Rejection"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Dialog */}
      <Dialog open={isCommissionDialogOpen} onOpenChange={setIsCommissionDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Assign Restaurant Commission Rate
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Set a custom commission rate for this specific culinary partner.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {(() => {
              const currentEditingSeller = data?.sellers?.find((s: any) => s.id === selectedSellerId)
              const currentBaseRate = currentEditingSeller?.baseCommissionRate ?? data?.baseCommission ?? 10
              return (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="commRate" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Commission Percentage (%)</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        Admin Base: <strong className="text-purple-600 dark:text-purple-400 font-bold">{currentBaseRate}%</strong>
                      </span>
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
                      💡 Leave empty to use admin default restaurant base commission (<strong className="text-foreground">{currentBaseRate}%</strong>).
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      📌 Custom rates take immediate effect on all new food orders.
                    </p>
                  </div>
                </>
              )
            })()}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="rounded-2xl text-xs font-medium" onClick={() => setIsCommissionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              disabled={actionLoading === selectedSellerId}
              onClick={() => {
                if (selectedSellerId) {
                  handleUpdateCommission(selectedSellerId, commissionValue === "" ? null : Number(commissionValue))
                }
              }}
            >
              {actionLoading === selectedSellerId ? "Saving..." : "Save Commission Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Direct Custom Email Modal ── */}
      <SellerEmailModal
        open={!!emailModalTarget}
        onOpenChange={(open) => !open && setEmailModalTarget(null)}
        seller={emailModalTarget}
      />

      {/* ── Bulk Onboarding Reminder Wizard Modal ── */}
      <OnboardingReminderWizardModal
        open={isOnboardingReminderOpen}
        onOpenChange={setIsOnboardingReminderOpen}
        initialSellerType="RESTAURANT"
      />

      {/* ── Bulk Custom Email Broadcast Modal ── */}
      <BulkCustomEmailModal
        open={isBulkCustomEmailOpen}
        onOpenChange={setIsBulkCustomEmailOpen}
        initialSellerType="RESTAURANT"
      />
    </div>
  )
}
