"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Badge } from "@/ui/badge"
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
import { DocumentThumbnail } from "@/components/admin/document-viewer"
import { Alert, AlertDescription } from "@/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"
import {
  Users,
  CheckCircle,
  AlertCircle,
  Ban,
  Eye,
  Store,
  Mail,
  Phone,
  CreditCard,
  Building2,
  FileText,
  Camera,
  Clock2,
  Globe,
  Hash,
  ShieldCheck,
  ChevronDown,
  X,
  User,
  MapPin,
  MapPinned,
  Search,
  Handshake,
  Check
} from "lucide-react"

export function SellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"
  const searchQ = searchParams.get("search") ?? ""
  const typeFilter = searchParams.get("type") ?? "ALL"

  // Local state for the search input to avoid re-rendering on every keystroke
  const [searchInput, setSearchInput] = useState(searchQ)

  const [data, setData] = useState<{
    sellers: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null)

  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionValue, setCommissionValue] = useState<number | "">("")

  const successParam = searchParams.get("success")
  const errorParam = searchParams.get("error")

  const loadSellers = useCallback(
    (opts?: { showLoading?: boolean }) => {
      const showLoading = opts?.showLoading !== false
      if (showLoading) {
        setLoading(true)
        setError(null)
      }
      const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
      const searchQs = searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""
      const typeQs = typeFilter !== "ALL" ? `&type=${encodeURIComponent(typeFilter)}` : ""
      
      return fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}${searchQs}${typeQs}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch sellers")
          return res.json()
        })
        .then((json) => {
          setData(json)
        })
        .catch((e) => {
          setError(e.message)
        })
        .finally(() => {
          if (showLoading) setLoading(false)
        })
    },
    [page, perPage, tab, searchQ, typeFilter]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
    const searchQs = searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""
    const typeQs = typeFilter !== "ALL" ? `&type=${encodeURIComponent(typeFilter)}` : ""
    
    fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}${searchQs}${typeQs}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sellers")
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
  }, [page, perPage, tab, searchQ, typeFilter])

  const handleApprove = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/approve`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=approved")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/suspend`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=suspended")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async (sellerId: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/unsuspend`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push("/admin/sellers?success=unsuspended")
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdminAction = async (sellerId: string, action: string, feedback?: string) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, feedback })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      router.push(`/admin/sellers?success=${action}_success`)
      router.refresh()
    } catch (e: any) {
      router.push(`/admin/sellers?error=${encodeURIComponent(e.message)}`)
    } finally {
        setActionLoading(null)
    }
  }

  const handleUpdateCommission = async (sellerId: string, rate: number | null) => {
    setActionLoading(sellerId)
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      await loadSellers({ showLoading: false })
      setIsCommissionDialogOpen(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const params = {
    error: errorParam ?? undefined,
    success: successParam ?? undefined,
    tab: tab === "all" ? undefined : tab,
    search: searchQ || undefined,
    type: typeFilter === "ALL" ? undefined : typeFilter,
  }

  const sellerTabs = [
    { id: "all", label: "All Sellers", icon: Users },
    { id: "pending", label: "Review Pending", icon: AlertCircle },
    { id: "approved", label: "Fully Approved", icon: CheckCircle },
    { id: "suspended", label: "Suspended", icon: Ban },
  ] as const

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Seller Management</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Moderate applications and monitor seller performance</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="outline" className="px-3 py-1 text-xs font-medium rounded-full shadow-sm bg-background border-primary/20 text-primary">
              {data.totalCount} Total Sellers
            </Badge>
          )}
        </div>
      </div>

      {params.error && (
        <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">{decodeURIComponent(params.error)}</AlertDescription>
        </Alert>
      )}
      {params.success && (
        <Alert className="border-none shadow-xl bg-green-500/10 text-green-600 animate-in slide-in-from-top-4 duration-500">
          <CheckCircle className="h-5 w-5" />
          <AlertDescription className="font-medium uppercase tracking-widest text-xs">Action completed: {params.success}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b">
            {/* FILTERS */}
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Name Search */}
              <div className="relative flex-1 md:max-w-[300px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search sellers by name..." 
                  className="pl-9 bg-background/50 border-muted rounded-xl"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const paramObj = { ...params, search: searchInput || undefined }
                      router.push(buildAdminPageUrl("/admin/sellers", 1, paramObj))
                    }
                  }}
                />
              </div>

              {/* Seller Type Select */}
              <Select 
                value={typeFilter} 
                onValueChange={(val) => {
                   router.push(buildAdminPageUrl("/admin/sellers", 1, { ...params, type: val === "ALL" ? undefined : val }))
                }}
              >
                <SelectTrigger className="w-[160px] bg-background/50 border-muted rounded-xl">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="PRODUCT">Product Sellers</SelectItem>
                  <SelectItem value="SERVICE">Service Providers</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Select */}
              <Select 
                value={tab} 
                onValueChange={(val) => {
                   router.push(buildAdminPageUrl("/admin/sellers", 1, { ...params, tab: val === "all" ? undefined : val }))
                }}
              >
                <SelectTrigger className="w-[160px] bg-background/50 border-muted rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sellers</SelectItem>
                  <SelectItem value="pending">Review Pending</SelectItem>
                  <SelectItem value="approved">Fully Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {/* Search Button */}
              <Button 
                onClick={() => {
                  const paramObj = { ...params, search: searchInput || undefined }
                  router.push(buildAdminPageUrl("/admin/sellers", 1, paramObj))
                }}
                className="rounded-xl px-6 gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
        {loading ? (
          <div className="py-32">
            <PageLoader message="Curating seller list…" />
          </div>
        ) : error ? (
          <div className="py-24 text-center px-6">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" className="mt-4 rounded-full font-medium" onClick={() => loadSellers()}>Try Again</Button>
          </div>
        ) : !data ? null : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30 border-none transition-none">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="py-4 pl-8 text-xs font-medium text-muted-foreground/80">Identity</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/80">Venture</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/80">Classification</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/80">Standing</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/80">Subscription</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/80">Commission</TableHead>
                    <TableHead className="text-right pr-8 text-xs font-medium text-muted-foreground/80">Control</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {data.sellers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-24">
                          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-xs">No matching sellers identified</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.sellers.map((seller: any) => {
                        const isExpanded = expandedSellerId === seller.id
                        return (
                          <Fragment key={seller.id}>
                            <TableRow className={cn(
                              "group transition-all hover:bg-muted/20 border-b border-muted/30",
                              isExpanded && "bg-muted/10 shadow-inner"
                            )}>
                              <TableCell className="py-5 pl-8 font-medium">
                                <div className="flex flex-col">
                                  <span>{seller.user?.name || "Unnamed Entity"}</span>
                                  <span className="text-[10px] text-muted-foreground/70 font-mono tracking-tighter font-medium">{seller.user?.email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-orange-500/5 rounded-lg border border-orange-500/10">
                                    <Store className="h-3.5 w-3.5 text-orange-500" />
                                  </div>
                                  <span className="font-medium text-sm line-clamp-1">{seller.store?.name || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-3 py-0.5 border-none shadow-sm uppercase tracking-wider bg-indigo-500/10 text-indigo-600">
                                  {seller.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge 
                                    className={cn(
                                      "rounded-full text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 border-none shadow-sm",
                                      seller.isApproved ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                                    )}
                                  >
                                    {seller.isApproved ? "Approved" : "Review Stage"}
                                  </Badge>
                                  {seller.isSuspended && (
                                    <Badge className="bg-destructive text-white rounded-full text-[9px] font-medium uppercase tracking-widest px-2 py-0.5 border-none shadow-sm">
                                      Suspended
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {seller.subscription?.plan?.displayName ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-xs font-medium text-primary/80 uppercase">{seller.subscription.plan.displayName}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-40">None</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {seller.commissionRate != null ? (
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer group/comm"
                                    onClick={() => {
                                      setSelectedSellerId(seller.id)
                                      setCommissionValue(seller.commissionRate)
                                      setIsCommissionDialogOpen(true)
                                    }}
                                  >
                                    <Badge className="bg-amber-500/10 text-amber-600 border-none rounded-full px-2.5 font-bold text-[10px] shadow-sm group-hover/comm:bg-amber-500 group-hover/comm:text-white transition-all">
                                      {seller.commissionRate}%
                                    </Badge>
                                  </div>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 hover:text-primary hover:bg-primary/5 rounded-full"
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
                              <TableCell className="text-right pr-8">
                                <div className="flex justify-end items-center gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      "h-8 w-8 rounded-full transition-all duration-300",
                                      isExpanded ? "bg-primary text-primary-foreground rotate-180" : "hover:bg-primary/10 hover:text-primary"
                                    )}
                                    onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  
                                  <div className="flex items-center gap-2 transition-all duration-300">
                                    {!seller.isApproved && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 rounded-full font-medium uppercase tracking-widest text-[9px] bg-green-500 hover:bg-green-600"
                                        disabled={actionLoading === seller.id}
                                        onClick={() => handleApprove(seller.id)}
                                      >
                                        Approve
                                      </Button>
                                    )}
                                    {seller.isSuspended ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-full font-medium uppercase tracking-widest text-[9px] border-blue-500 text-blue-500 hover:bg-blue-50"
                                        disabled={actionLoading === seller.id}
                                        onClick={() => handleUnsuspend(seller.id)}
                                      >
                                        Unsuspend
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        className="h-8 rounded-full font-medium uppercase tracking-widest text-[9px] shadow-lg shadow-destructive/10"
                                        disabled={actionLoading === seller.id}
                                        onClick={() => handleSuspend(seller.id)}
                                      >
                                        Suspend
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-muted/5 border-b border-muted/30">
                                <TableCell colSpan={7} className="p-0">
                                  <div className="p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
                                    <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                                      
                                      {/* PART 1: CORPORATE DNA - Identity */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <div className="flex items-center justify-between">
                                            <CardTitle className="text-xs font-medium flex items-center gap-2 text-primary">
                                              <User className="h-4 w-4" /> Personal / Corporate Identity
                                            </CardTitle>
                                            {seller.user?.image && (
                                              <div className="w-8 h-8 rounded-full border-2 border-primary/20 overflow-hidden shadow-sm">
                                                <img src={seller.user.image} className="w-full h-full object-cover" />
                                              </div>
                                            )}
                                          </div>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4 flex-1">
                                          <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                              <div className="p-2 bg-muted rounded-xl"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                              <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Legal Name</span><span className="text-sm font-medium">{seller.user?.name || "—"}</span></div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="p-2 bg-muted rounded-xl"><Mail className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                              <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Email</span><span className="text-sm font-medium">{seller.user?.email}</span></div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="p-2 bg-muted rounded-xl"><Phone className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                              <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">Contact</span><span className="text-sm font-medium">{seller.user?.phoneCountryCode} {seller.user?.phone}</span></div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="p-2 bg-muted rounded-xl"><FileText className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                              <div className="flex flex-col"><span className="text-[10px] font-medium text-muted-foreground/60">NIN</span><span className="text-sm font-medium">{seller.nationIdentityNumber || "Pending"}</span></div>
                                            </div>
                                          </div>
                                          
                                          {seller.adminFeedback && (
                                            <div className="mt-4 p-3 bg-red-500/5 rounded-2xl border border-red-500/10">
                                              <span className="text-[8px] font-medium uppercase text-red-600 tracking-widest block mb-1">Administrative Memo</span>
                                              <p className="text-xs font-medium text-muted-foreground line-clamp-2 italic">“{seller.adminFeedback}”</p>
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>

                                      {/* PART 2: LEGAL VENTURE - Business */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-indigo-500 shrink-0">
                                            <Building2 className="h-4 w-4" /> Legal Venture
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4 flex-1">
                                          <div className="p-3 bg-muted/40 rounded-xl border border-muted/50">
                                            <span className="text-[9px] font-medium text-muted-foreground/60 block mb-1">Trade Name</span>
                                            <span className="text-sm font-medium">{seller.businessInfo?.businessName || seller.store?.name || "—"}</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-medium text-muted-foreground/60">Structure</span>
                                              <span className="text-sm font-medium">{seller.businessInfo?.businessType || "—"}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-medium text-muted-foreground/60">Registration #</span>
                                              <span className="text-sm font-medium truncate">{seller.businessInfo?.businessRegNumber || "—"}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-medium text-muted-foreground/60">Tax ID / Tin no</span>
                                              <span className="text-sm font-medium">{seller.businessInfo?.taxIdNumber || "—"}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-medium text-muted-foreground/60">GST Registered</span>
                                              <Badge variant="outline" className={cn("w-fit text-[9px] font-medium uppercase", seller.businessInfo?.haveGst ? "bg-green-500/10 text-green-600 border-green-200" : "bg-red-500/10 text-red-600 border-red-200")}>
                                                {seller.businessInfo?.haveGst ? "Yes" : "No"}
                                              </Badge>
                                            </div>
                                            {seller.businessInfo?.haveGst && (
                                              <>
                                                <div className="flex flex-col gap-1">
                                                  <span className="text-[10px] font-medium text-muted-foreground/60">GST Customer Name</span>
                                                  <span className="text-sm font-medium">{seller.businessInfo?.gstCustomerName || "—"}</span>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  <span className="text-[10px] font-medium text-muted-foreground/60">GST Inv No</span>
                                                  <span className="text-sm font-medium">{seller.businessInfo?.gstInvNo || "—"}</span>
                                                </div>
                                              </>
                                            )}
                                          </div>

                                          <div className="pt-2 flex flex-col gap-3 border-t border-muted">
                                            <div className="flex items-start gap-3">
                                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                              <div className="flex flex-col">
                                                <span className="text-[10px] font-medium text-muted-foreground/60">Headquarters</span>
                                                <span className="text-xs font-medium leading-relaxed">{seller.businessInfo?.street}, {seller.businessInfo?.district}, {seller.businessInfo?.city} {seller.businessInfo?.postalCode}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* PART 3: STORE VISUALS & OFFERINGS */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-primary">
                                            <Store className="h-4 w-4" /> Store Visuals & Offerings
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4 flex-1">
                                          <div className="grid grid-cols-2 gap-3">
                                            <DocumentThumbnail url={seller.store?.logo} title="Store Logo" />
                                            <DocumentThumbnail url={seller.store?.banner} title="Store Banner" />
                                          </div>

                                          <div className="pt-2 flex flex-col gap-3">
                                            {seller.store?.address && (
                                              <div className="flex items-start gap-2 bg-muted/20 p-2 rounded-xl">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">Store text location</span>
                                                  <span className="text-xs font-medium leading-tight">{seller.store.address}</span>
                                                </div>
                                              </div>
                                            )}

                                            {seller.store?.lat && seller.store?.lng ? (
                                              <div className="flex flex-col gap-1.5 mt-2 rounded-xl border border-muted/50 p-2 relative h-28 overflow-hidden group">
                                                <img 
                                                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${seller.store.lat},${seller.store.lng}&zoom=15&size=400x150&markers=color:red%7C${seller.store.lat},${seller.store.lng}&key=${process.env.NEXT_PUBLIC_MAP_KEY}`}
                                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-700"
                                                  alt="Map static"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-3 py-1 flex justify-between items-center text-[10px] font-medium border-t border-muted/50">
                                                  <span className="text-primary flex items-center gap-1.5"><MapPinned className="h-3 w-3" /> Pinpoint Location</span>
                                                  <span>{seller.store.lat.toFixed(5)}, {seller.store.lng.toFixed(5)}</span>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col justify-center items-center py-4 bg-muted/10 rounded-xl border border-dashed border-muted/50 h-28">
                                                 <MapPin className="h-5 w-5 text-muted-foreground/30 mb-2" />
                                                 <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">Location unlisted</span>
                                              </div>
                                            )}
                                          </div>

                                          <div className="pt-4 border-t border-muted space-y-2">
                                            <span className="text-[10px] font-medium uppercase text-muted-foreground/60 tracking-[0.2em]">{seller.type === "PRODUCT" ? "Authorized Categories" : "Authorized Services"}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                              {(seller.type === "PRODUCT" ? seller.selectedCategories : seller.selectedServiceCategories)?.map((c: any) => (
                                                <Badge key={c.id} variant="outline" className="rounded-full text-[9px] font-medium uppercase tracking-tighter bg-primary/5 border-primary/20 text-primary">{c.name}</Badge>
                                              )) || <span className="text-xs text-muted-foreground font-medium">Undefined</span>}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* PART 4: FINANCIAL ANCHOR - Bank */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-indigo-500">
                                            <CreditCard className="h-4 w-4" /> Financial Details
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4 flex-1">
                                          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                            <div className="space-y-4">
                                              <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-medium text-primary/60 ml-1">Bank Name</span>
                                                <div className="bg-white p-2.5 rounded-xl border border-primary/10 font-medium text-sm text-primary shadow-sm flex items-center gap-2">
                                                  <Building2 className="w-4 h-4" /> {seller.bankDetails?.bankName || "—"}
                                                </div>
                                              </div>
                                              
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground/60 mb-1 ml-1">Beneficiary</span>
                                                  <span className="text-xs font-medium truncate">{seller.bankDetails?.accountHolderName || "—"}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground/60 mb-1 ml-1">Branch</span>
                                                  <span className="text-xs font-medium truncate">{seller.bankDetails?.branchName || "Main Branch"}</span>
                                                </div>
                                              </div>

                                              <div className="flex flex-col p-3 bg-white rounded-xl border border-primary/10 shadow-inner">
                                                <span className="text-[9px] font-medium text-muted-foreground/60 mb-1">Account Signature</span>
                                                <span className="text-sm font-mono font-medium tracking-tight">{seller.bankDetails?.accountNumber || "—"}</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="space-y-3 pt-2">
                                            <div className="flex justify-between items-center px-2">
                                              <span className="text-[10px] font-medium text-muted-foreground/60">Payout Channel</span>
                                              <Badge className="bg-primary/10 text-primary border-none rounded-full font-medium text-[9px] uppercase tracking-widest">{seller.bankDetails?.preferredPayoutMethod || "Transfer"}</Badge>
                                            </div>
                                            {seller.bankDetails?.mobileMoneyOption && (
                                              <div className="flex justify-between items-center px-2">
                                                <span className="text-[10px] font-medium text-muted-foreground/60">Mobile Provider</span>
                                                <span className="text-xs font-medium">{seller.bankDetails.mobileMoneyOption}</span>
                                              </div>
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* PART 5: KYC EVIDENCE - Documents */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col md:col-span-2 2xl:col-span-1">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-emerald-500">
                                            <ShieldCheck className="h-4 w-4" /> Verification & KYC Documents
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-6 flex-1">
                                          <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                                            <div className="flex flex-col"><span className="text-[9px] font-medium text-emerald-600/60 mb-0.5">Verification Method</span><span className="text-xs font-medium">{seller.kyc?.idType || "Biometric"}</span></div>
                                            <div className="text-xs font-mono font-medium tracking-normal bg-white px-2.5 py-1 rounded-lg shadow-sm border border-emerald-100">{seller.kyc?.idNumber || "—"}</div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                            <DocumentThumbnail url={seller.kyc?.idFrontUrl} title="ID Front Image" />
                                            <DocumentThumbnail url={seller.kyc?.idBackUrl} title="ID Back Image" />
                                            <DocumentThumbnail url={seller.kyc?.selfieUrl} title="Live Selfie" />
                                            <DocumentThumbnail url={seller.businessInfo?.busRegCertUrl} title="Business Reg Document" mimeType="application/pdf" />
                                            <DocumentThumbnail url={seller.bankDetails?.passbookUrl} title="Bank Passbook" />
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* PART 6: AGREEMENTS & COMPLIANCE */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden flex flex-col">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-amber-500">
                                            <Handshake className="h-4 w-4" /> Agreements & Policies
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 flex flex-col items-center justify-center flex-1 space-y-4">
                                            {seller.agreement ? (
                                              <div className="w-full space-y-3">
                                                 <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                                                    <span className="text-xs font-medium text-muted-foreground">General Terms Accepted</span>
                                                    <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.acceptedTerms ? "bg-emerald-500" : "bg-red-500")}>
                                                       {seller.agreement.acceptedTerms ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                    </Badge>
                                                 </div>
                                                 <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                                                    <span className="text-xs font-medium text-muted-foreground">Privacy Policy Accepted</span>
                                                    <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.acceptedPrivacyPolicy ? "bg-emerald-500" : "bg-red-500")}>
                                                       {seller.agreement.acceptedPrivacyPolicy ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                    </Badge>
                                                 </div>
                                                 <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                                                    <span className="text-xs font-medium text-muted-foreground">Return Policy Check</span>
                                                    <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.acceptedReturnPolicy ? "bg-emerald-500" : "bg-red-500")}>
                                                       {seller.agreement.acceptedReturnPolicy ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                    </Badge>
                                                 </div>
                                                 <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-muted">
                                                    <span className="text-xs font-medium text-muted-foreground">Commission Details</span>
                                                    <Badge className={cn("rounded-full h-5 w-5 p-0 flex items-center justify-center border-none", seller.agreement.acceptedCommission ? "bg-emerald-500" : "bg-red-500")}>
                                                       {seller.agreement.acceptedCommission ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                    </Badge>
                                                 </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                                                 <AlertCircle className="h-8 w-8 text-amber-500/50" />
                                                 <span className="text-sm font-medium text-muted-foreground block text-balance">The seller has not finalized the agreement stage.</span>
                                              </div>
                                            )}
                                        </CardContent>
                                      </Card>

                                      {/* ACTION INFRASTRUCTURE */}
                                      <div className="md:col-span-2 2xl:col-span-3 flex flex-col md:flex-row items-center justify-between gap-8 p-6 bg-muted/10 rounded-2xl border-2 border-dashed border-muted/50 mt-4">
                                        <div className="flex items-center gap-6">
                                          <div className="space-y-1 relative group">
                                            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                              Onboarding Progress 
                                              {seller.onboardingCompleted && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                                            </div>
                                            <div className="text-sm font-medium flex items-center gap-2">
                                              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">Step {seller.onboardingStep} of 5</Badge>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-3 shrink-0">
                                          {!seller.isApproved && (
                                            <>
                                              <Button
                                                variant="outline"
                                                className="rounded-xl font-medium text-xs h-11 px-6 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-md shadow-orange-500/10 active:scale-95"
                                                onClick={() => {
                                                  setSelectedSellerId(seller.id)
                                                  setFeedbackText("")
                                                  setIsCorrectionDialogOpen(true)
                                                }}
                                              >
                                                Correction Needed
                                              </Button>

                                              <Button
                                                variant="destructive"
                                                className="rounded-xl font-medium text-xs h-11 px-8 shadow-md shadow-destructive/20 hover:scale-105 active:scale-95 transition-all"
                                                onClick={() => {
                                                  setSelectedSellerId(seller.id)
                                                  setIsRejectDialogOpen(true)
                                                }}
                                              >
                                                Reject Seller
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      
                                    </div>
                                  </div>

                                    {/* Correction Dialog */}
                                    <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Request Correction</DialogTitle>
                                          <DialogDescription>
                                            Detail the necessary changes required for this seller application. This message will be sent to the seller.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                          <Textarea
                                            placeholder="Example: Your business registration document is blurry. Please upload a clearer copy."
                                            value={feedbackText}
                                            onChange={(e) => setFeedbackText(e.target.value)}
                                            className="min-h-[120px]"
                                          />
                                        </div>
                                        <DialogFooter>
                                          <Button variant="outline" onClick={() => setIsCorrectionDialogOpen(false)}>Cancel</Button>
                                          <Button
                                            className="bg-orange-500 hover:bg-orange-600"
                                            disabled={!feedbackText.trim() || actionLoading === selectedSellerId}
                                            onClick={async () => {
                                              if (selectedSellerId) {
                                                await handleAdminAction(selectedSellerId, "correction", feedbackText)
                                                setIsCorrectionDialogOpen(false)
                                              }
                                            }}
                                          >
                                            {actionLoading === selectedSellerId ? "Processing..." : "Send Request"}
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>

                                    {/* Reject Dialog */}
                                    <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle className="text-destructive">Reject Seller Application</DialogTitle>
                                          <DialogDescription>
                                            Are you sure you want to permanently reject this seller? This action cannot be undone and will prevent the seller from operating on the platform.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                          <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                                          <Button
                                            variant="destructive"
                                            disabled={actionLoading === selectedSellerId}
                                            onClick={async () => {
                                              if (selectedSellerId) {
                                                await handleAdminAction(selectedSellerId, "reject")
                                                setIsRejectDialogOpen(false)
                                              }
                                            }}
                                          >
                                            {actionLoading === selectedSellerId ? "Rejecting..." : "Reject Permanently"}
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>

                                    {/* Commission Dialog */}
                                    <Dialog open={isCommissionDialogOpen} onOpenChange={setIsCommissionDialogOpen}>
                                      <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-[2rem]">
                                        <DialogHeader>
                                          <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-amber-500/10 rounded-xl">
                                              <Globe className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <DialogTitle className="text-xl font-medium">Assign Seller Commission</DialogTitle>
                                          </div>
                                          <DialogDescription className="text-sm font-medium opacity-60">
                                            Set a custom commission rate for this specific seller. This will override the platform base rate.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-8 space-y-4">
                                          <div className="space-y-3">
                                            <Label htmlFor="commRate" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Override Rate (%)</Label>
                                            <div className="relative">
                                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-bold">%</div>
                                              <Input
                                                id="commRate"
                                                type="number"
                                                placeholder="e.g. 12.5"
                                                step="0.1"
                                                value={commissionValue}
                                                onChange={(e) => setCommissionValue(e.target.value ? parseFloat(e.target.value) : "")}
                                                className="pl-12 border-muted bg-muted/20 rounded-2xl h-14 focus-visible:ring-amber-500 font-bold text-lg shadow-inner"
                                              />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/60 ml-1 italic">* Leave empty or set to 0 to use platform default.</p>
                                          </div>
                                        </div>
                                        <DialogFooter className="gap-3">
                                          <Button variant="ghost" className="rounded-full px-6 font-medium text-xs uppercase tracking-widest" onClick={() => setIsCommissionDialogOpen(false)}>Cancel</Button>
                                          <Button
                                            className="bg-amber-500 hover:bg-amber-600 rounded-full px-8 h-12 font-medium uppercase tracking-[0.1em] text-[10px] shadow-lg shadow-amber-500/20"
                                            disabled={actionLoading === selectedSellerId}
                                            onClick={() => {
                                              if (selectedSellerId) {
                                                handleUpdateCommission(selectedSellerId, commissionValue === "" ? null : Number(commissionValue))
                                              }
                                            }}
                                          >
                                            {actionLoading === selectedSellerId ? "Synchronizing..." : "Update Commission"}
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
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
              <div className="p-8 bg-muted/10 border-t border-muted/20 rounded-b-3xl">
                <AdminPagination
                  basePath="/admin/sellers"
                  currentPage={page}
                  totalPages={data.totalPages}
                  totalCount={data.totalCount}
                  pageSize={perPage}
                  params={params}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
