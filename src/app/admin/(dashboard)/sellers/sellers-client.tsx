"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { cn } from "@/lib/utils"
import { buildAdminPageUrl } from "@/lib/admin-pagination"
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
import { Alert, AlertDescription } from "@/ui/alert"
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
  MapPin
} from "lucide-react"

export function SellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"

  const [data, setData] = useState<{
    sellers: any[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null)

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
      return fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}`)
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
    [page, perPage, tab]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
    fetch(`/api/admin/sellers?page=${page}&perPage=${perPage}${tabQs}`)
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
  }, [page, perPage, tab])

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

  const params = {
    error: errorParam ?? undefined,
    success: successParam ?? undefined,
    tab: tab === "all" ? undefined : tab,
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
          <div className="flex flex-wrap gap-2 p-1.5 bg-muted/40 rounded-xl border border-muted/20 w-fit">
            {sellerTabs.map((t) => (
              <Link
                key={t.id}
                href={buildAdminPageUrl("/admin/sellers", 1, {
                  error: params.error,
                  success: params.success,
                  tab: t.id === "all" ? undefined : t.id,
                })}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  tab === t.id
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <t.icon className={cn("h-3.5 w-3.5", tab === t.id ? "text-primary" : "text-muted-foreground/60")} />
                {t.label}
              </Link>
            ))}
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
                    <TableHead className="text-right pr-8 text-xs font-medium text-muted-foreground/80">Control</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {data.sellers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-24">
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
                                <TableCell colSpan={6} className="p-0">
                                  <div className="p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                                      {/* CORPORATE DNA - Identity */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <div className="flex items-center justify-between">
                                            <CardTitle className="text-xs font-medium flex items-center gap-2 text-primary">
                                              <Building2 className="h-4 w-4" /> Corporate DNA
                                            </CardTitle>
                                            {seller.user?.image && (
                                              <div className="w-8 h-8 rounded-full border-2 border-primary/20 overflow-hidden shadow-sm">
                                                <img src={seller.user.image} className="w-full h-full object-cover" />
                                              </div>
                                            )}
                                          </div>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
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

                                          <div className="pt-4 border-t space-y-2">
                                            <span className="text-[10px] font-medium uppercase text-muted-foreground/60 tracking-[0.2em]">Authorized Niche</span>
                                            <div className="flex flex-wrap gap-1.5">
                                              {(seller.type === "PRODUCT" ? seller.selectedCategories : seller.selectedServiceCategories)?.map((c: any) => (
                                                <Badge key={c.id} variant="outline" className="rounded-full text-[9px] font-medium uppercase tracking-tighter bg-primary/5 border-primary/20 text-primary">{c.name}</Badge>
                                              )) || <span className="text-xs text-muted-foreground font-medium">Undefined</span>}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* LEGAL VENTURE - Business */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <div className="flex items-center justify-between">
                                            <CardTitle className="text-xs font-medium flex items-center gap-2 text-indigo-500">
                                              <Store className="h-4 w-4" /> Legal Venture
                                            </CardTitle>
                                            {seller.store?.logo && (
                                              <div className="w-8 h-8 rounded-lg border border-indigo-500/20 overflow-hidden shadow-sm">
                                                <img src={seller.store.logo} className="w-full h-full object-cover" />
                                              </div>
                                            )}
                                          </div>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
                                          <div className="space-y-4">
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
                                              <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-medium text-muted-foreground/60">Status</span>
                                                <Badge variant="outline" className="w-fit text-[9px] font-medium uppercase">{seller.status}</Badge>
                                              </div>
                                            </div>

                                            <div className="pt-2">
                                              <div className="flex items-start gap-3">
                                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                  <span className="text-[10px] font-medium text-muted-foreground/60">Headquarters</span>
                                                  <span className="text-xs font-medium leading-relaxed">{seller.businessInfo?.street}, {seller.businessInfo?.district}, {seller.businessInfo?.city} {seller.businessInfo?.postalCode}</span>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-muted">
                                              <div className="flex items-center gap-2">
                                                <Clock2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                <div className="flex flex-col">
                                                  <span className="text-[8px] font-medium text-muted-foreground/50">Market Entry</span>
                                                  <span className="text-[10px] font-medium">{seller.businessInfo?.yearsInOperation ? `${seller.businessInfo.yearsInOperation}y Experience` : "—"}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                                <div className="flex flex-col">
                                                  <span className="text-[8px] font-medium text-muted-foreground/50">Industry Niche</span>
                                                  <span className="text-[10px] font-medium capitalize truncate">{seller.businessInfo?.natureOfBusiness || "—"}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {seller.businessInfo?.busRegCertUrl && (
                                            <Button variant="link" className="p-0 h-auto text-[10px] font-medium uppercase tracking-widest text-primary underline decoration-2 underline-offset-4" onClick={() => window.open(seller.businessInfo.busRegCertUrl)}>
                                              View Registration Certificate
                                            </Button>
                                          )}
                                        </CardContent>
                                      </Card>

                                      {/* FINANCIAL ANCHOR - Bank */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-primary">
                                            <CreditCard className="h-4 w-4" /> Financial Anchor
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
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

                                          {seller.bankDetails?.passbookUrl && (
                                            <Button variant="link" className="p-0 h-auto text-[10px] font-medium uppercase tracking-widest text-indigo-500 underline decoration-2 underline-offset-4 mt-2 ml-2" onClick={() => window.open(seller.bankDetails.passbookUrl)}>
                                              Verify Financial Document
                                            </Button>
                                          )}
                                        </CardContent>
                                      </Card>

                                      {/* KYC EVIDENCE - Documents */}
                                      <Card className="border-none shadow-md bg-background rounded-2xl overflow-hidden">
                                        <CardHeader className="bg-muted/30 pb-4">
                                          <CardTitle className="text-xs font-medium flex items-center gap-2 text-emerald-500">
                                            <ShieldCheck className="h-4 w-4" /> KYC Evidence
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-6">
                                          <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                                            <div className="flex flex-col"><span className="text-[9px] font-medium text-emerald-600/60 mb-0.5">Verification Method</span><span className="text-xs font-medium">{seller.kyc?.idType || "Biometric"}</span></div>
                                            <div className="text-xs font-mono font-medium tracking-normal bg-white px-2.5 py-1 rounded-lg shadow-sm border border-emerald-100">{seller.kyc?.idNumber || "—"}</div>
                                          </div>
                                          
                                          <div className="grid grid-cols-3 gap-3">
                                            {[
                                              { label: "Front", url: seller.kyc?.idFrontUrl },
                                              { label: "Back", url: seller.kyc?.idBackUrl },
                                              { label: "Biometric", url: seller.kyc?.selfieUrl },
                                            ].map((img, idx) => img.url ? (
                                              <div key={idx} className="group/img relative aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-muted cursor-zoom-in shadow-sm hover:shadow-md transition-all" onClick={() => window.open(img.url)}>
                                                <img src={img.url} className="h-full w-full object-cover transition-transform group-hover/img:scale-110 duration-500" />
                                                <div className="absolute inset-x-0 bottom-0 py-1 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                                                  <span className="text-[8px] font-medium text-white uppercase tracking-widest">{img.label}</span>
                                                </div>
                                              </div>
                                            ) : (
                                              <div key={idx} className="aspect-[4/3] rounded-xl bg-muted/30 border-2 border-dashed border-muted/50 flex items-center justify-center">
                                                <Camera className="h-4 w-4 text-muted-foreground/20" />
                                              </div>
                                            ))}
                                          </div>
                                        </CardContent>
                                      </Card>

                                      {/* ACTION INFRASTRUCTURE */}
                                      <div className="lg:col-span-4 flex flex-col md:flex-row items-center justify-between gap-8 p-8 bg-muted/30 rounded-2xl border border-muted/50 shadow-sm">
                                        <div className="flex items-center gap-6">
                                          <div className="p-4 bg-primary/10 rounded-2xl shadow-md shadow-primary/5 border border-primary/5">
                                            <Building2 className="h-8 w-8 text-primary" />
                                          </div>
                                          <div className="space-y-2">
                                            <h4 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40 font-mono">Administrative Gating</h4>
                                            <div className="flex flex-wrap items-center gap-6">
                                               <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground uppercase mb-1">Onboarding Depth</span>
                                                  <Badge className="bg-indigo-500/10 text-indigo-600 border-none rounded-full px-3 font-medium text-[9px]">Step {seller.onboardingStep} / 5</Badge>
                                               </div>
                                               <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground uppercase mb-1">Network Join Date</span>
                                                  <span className="text-sm font-medium tabular-nums">{new Date(seller.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                               </div>
                                               <div className="flex flex-col">
                                                  <span className="text-[9px] font-medium text-muted-foreground uppercase mb-1">Agreement Status</span>
                                                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Compliance Verified</span>
                                               </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-3 shrink-0 mt-4 md:mt-0">
                                          {!seller.isApproved && (
                                            <>
                                              <Button variant="outline" className="rounded-xl font-medium text-xs h-11 px-6 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-md shadow-orange-500/10 active:scale-95" onClick={() => {
                                                const msg = prompt("Detail the necessary corrections for this applicant:");
                                                if (msg) handleAdminAction(seller.id, "correction", msg);
                                              }}>Request Revisions</Button>
                                              
                                              <Button variant="destructive" className="rounded-xl font-medium text-xs h-11 px-8 shadow-md shadow-destructive/20 hover:scale-105 active:scale-95 transition-all" onClick={() => {
                                                if (confirm("Reject this seller application permanently? This cannot be undone.")) handleAdminAction(seller.id, "reject");
                                              }}>Purge Applicant</Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
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
