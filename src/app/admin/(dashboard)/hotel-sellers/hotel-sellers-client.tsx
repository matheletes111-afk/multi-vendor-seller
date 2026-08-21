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
  Building2, 
  Search, 
  X, 
  Calendar, 
  Filter, 
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Briefcase,
  Globe,
  ExternalLink,
  Percent,
} from "lucide-react"
import { HotelSellerDetailsView } from "@/components/admin/sellers/hotel-seller-details-view"
import { SellerFilterToolbar } from "@/components/admin/sellers/seller-filter-toolbar"
import { SellerDocumentBadge } from "@/components/admin/sellers/seller-document-badge"
import Link from "next/link"

export function HotelSellersClient() {
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
    fetch("/api/admin/plans?type=HOTEL")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPlans(data)
      })
      .catch((err) => console.error("Error loading hotel plans:", err))
  }, [])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)
  
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; action: string }>({ open: false, id: "", action: "" })
  const [feedback, setFeedback] = useState("")
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionValue, setCommissionValue] = useState<number | "">("")
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null)

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
    router.push(`/admin/hotel-sellers?${current.toString()}`)
  }, [router, searchParams])

  const handleUpdateCommission = async (sellerId: string, rate: number | null) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/hotel-sellers/${sellerId}/commission`, {
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

    fetch(`/api/admin/hotel-sellers?${params.toString()}`)
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

  const handleApplyFilters = () => {
    updateUrlParams({
      page: "1",
      search: searchInput.trim() || undefined,
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
    router.push("/admin/hotel-sellers")
  }

  const handleStatusAction = async (id: string, action: string, fb?: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/hotel-sellers/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: fb })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update status")
      
      setRejectDialog({ open: false, id: "", action: "" })
      setFeedback("")
      loadSellers()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && !data) return <PageLoader message="Loading hotel sellers..." />

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Hotel Seller Management
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Approve, verify, and monitor your hospitality and accommodation partners.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
                  <TableHead className="pl-6 py-4 min-w-[200px]">Identity / Host</TableHead>
                  <TableHead className="min-w-[170px]">Hotel / Property</TableHead>
                  <TableHead className="min-w-[110px]">Plan</TableHead>
                  <TableHead className="min-w-[120px]">Commission</TableHead>
                  <TableHead className="min-w-[130px]">Documents</TableHead>
                  <TableHead className="min-w-[130px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Joined Date</TableHead>
                  <TableHead className="text-right pr-6 min-w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.sellers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-24">
                      <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-semibold text-sm text-muted-foreground">No hotel partners identified</p>
                      <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your search filters.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.sellers?.map((seller: any) => {
                    const isExpanded = expandedSellerId === seller.id
                    const hotelName = seller.hotels?.[0]?.name || seller.businessInfo?.businessName || "Unnamed Property"

                    return (
                      <Fragment key={seller.id}>
                        <TableRow
                          className={cn(
                            "group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800",
                            isExpanded && "bg-slate-50 dark:bg-slate-800/60"
                          )}
                        >
                          {/* Identity */}
                          <TableCell className="pl-6 py-4 font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{seller.user?.name}</span>
                              <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{seller.user?.email}</span>
                              {seller.user?.phone && (
                                <span className="text-[11px] text-slate-400">{seller.user.phone}</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Hotel / Property */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg">
                                <Building2 className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                                  {hotelName}
                                </p>
                                {(seller.businessInfo?.city || seller.hotels?.[0]?.city) && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                                    {[seller.businessInfo?.city || seller.hotels?.[0]?.city, seller.businessInfo?.state || seller.hotels?.[0]?.state].filter(Boolean).join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Subscription Plan */}
                          <TableCell>
                            {seller.subscription?.plan?.name ? (
                              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
                                {seller.subscription.plan.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Free</span>
                            )}
                          </TableCell>

                          {/* Commission Rate */}
                          <TableCell>
                            {seller.commissionRate != null ? (
                              <div
                                className="cursor-pointer inline-flex items-center gap-1 group/comm"
                                onClick={() => {
                                  setSelectedSellerId(seller.id)
                                  setCommissionValue(seller.commissionRate)
                                  setIsCommissionDialogOpen(true)
                                }}
                                title="Click to edit commission rate"
                              >
                                <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-lg px-2 py-0.5 font-bold text-xs group-hover/comm:bg-purple-600 group-hover/comm:text-white transition-colors">
                                  {seller.commissionRate}%
                                </Badge>
                              </div>
                            ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2.5 text-[11px] font-semibold text-purple-700 bg-purple-50/70 border-purple-200/80 hover:bg-purple-100 hover:text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 rounded-lg cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedSellerId(seller.id)
                                    setCommissionValue("")
                                    setIsCommissionDialogOpen(true)
                                  }}
                                >
                                  Assign
                                </Button>
                            )}
                          </TableCell>

                          {/* Documents */}
                          <TableCell>
                            <SellerDocumentBadge evaluation={seller.documentEvaluation} />
                          </TableCell>

                          {/* Status */}
                          <TableCell>
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
                          </TableCell>

                          {/* Joined Date */}
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(seller.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end items-center gap-1.5">
                              <Link
                                href={`/admin/hotel-sellers/${seller.id}`}
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
                                onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
                                title="Toggle quick preview"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={8} className="p-6">
                              <div className="rounded-2xl bg-white dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                <HotelSellerDetailsView 
                                  seller={{ ...seller, plans }}
                                  actionLoading={actionLoading}
                                  onApprove={id => handleStatusAction(id, "approve")}
                                  onSuspend={id => handleStatusAction(id, "suspend")}
                                  onUnsuspend={id => handleStatusAction(id, "unsuspend")}
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
                basePath="/admin/hotel-sellers" 
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
                    ? "Inform the hotel partner about missing or invalid documents to update."
                    : "Provide a reason why this hotel seller application cannot be accepted."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-3 space-y-2">
             <Label className="text-xs font-semibold">
               {rejectDialog.action === "correction" ? "Correction Memo" : "Rejection Reason"}
             </Label>
             <Textarea 
                placeholder={rejectDialog.action === "correction" ? "e.g. Please re-upload your valid business registration with stamp..." : "Reason for rejection..."} 
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
                  Assign Hotel Commission Rate
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Set a custom commission rate for this specific hotel partner.
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
                📌 Custom rates take immediate effect on all new bookings.
              </p>
            </div>
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
    </div>
  )
}
