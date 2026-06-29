"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Textarea } from "@/ui/textarea"
import { Users, CheckCircle, AlertCircle, Ban, Eye, Briefcase, Search, X, Calendar, Filter, Utensils, ChevronDown, ChevronUp, Globe } from "lucide-react"
import { RestaurantSellerDetailsView } from "@/components/admin/sellers/restaurant-seller-details-view"
import Link from "next/link"


export function RestaurantSellersClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const tab = searchParams.get("tab") ?? "all"
  const searchQ = searchParams.get("search") ?? ""
  const startParam = searchParams.get("startDate") ?? ""
  const endParam = searchParams.get("endDate") ?? ""

  const [searchInput, setSearchInput] = useState(searchQ)
  const [startDate, setStartDate] = useState(startParam)
  const [endDate, setEndDate] = useState(endParam)
  const [localTab, setLocalTab] = useState(tab)

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
    const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
    const searchQs = searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""
    const startQs = startParam ? `&startDate=${encodeURIComponent(startParam)}` : ""
    const endQs = endParam ? `&endDate=${encodeURIComponent(endParam)}` : ""

    fetch(`/api/admin/restaurant-sellers?page=${page}&perPage=${perPage}${tabQs}${searchQs}${startQs}${endQs}`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, perPage, tab, searchQ, startParam, endParam])

  useEffect(() => {
    loadSellers()
  }, [loadSellers])

  const handleSearch = () => {
    const params = {
      tab: localTab === "all" ? undefined : localTab,
      search: searchInput || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }
    router.push(buildAdminPageUrl("/admin/restaurant-sellers", 1, params))
  }

  const handleClear = () => {
    setSearchInput("")
    setStartDate("")
    setEndDate("")
    setLocalTab("all")
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
      if (!res.ok) throw new Error("Failed to update status")
      
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
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Restaurant Seller Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Approve and monitor your culinary partners.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold shadow-sm">
            {data?.totalCount || 0} Total Partners
          </Badge>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-2 mb-6 px-4">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Search & Filters</CardTitle>
          </div>
          <div className="px-4">
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex-1 min-w-[300px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Partner Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Name, email, business name..." 
                    className="pl-9 rounded-2xl h-12 bg-background/50 border-muted focus-visible:ring-primary/20" 
                    value={searchInput} 
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>
              <div className="w-[200px] space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Status View</Label>
                <Select value={localTab} onValueChange={setLocalTab}>
                  <SelectTrigger className="rounded-2xl h-12 bg-background/50 border-muted">
                    <SelectValue placeholder="All Partners" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-xl">
                    <SelectItem value="all">All Partners</SelectItem>
                    <SelectItem value="pending">Review Pending</SelectItem>
                    <SelectItem value="approved">Fully Approved</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="rounded-2xl px-8 h-12 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                  Apply Search
                </Button>
                <Button variant="outline" onClick={handleClear} className="rounded-2xl px-6 h-12 font-medium border-muted hover:bg-muted/50">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="pl-8 py-5">Identity</TableHead>
                  <TableHead>Venture</TableHead>
                  <TableHead>Standing</TableHead>
                  <TableHead>Portfolio</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead className="text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.sellers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="flex flex-col items-center gap-2 opacity-20">
                        <Users className="h-16 w-16" />
                        <p className="font-black uppercase tracking-[0.3em] text-sm">No partners identified</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.sellers.map((seller: any) => {
                    const isExpanded = expandedRow === seller.id
                    return (
                      <Fragment key={seller.id}>
                        <TableRow className={cn(
                          "group transition-all hover:bg-muted/20 border-b border-muted/10 cursor-pointer",
                          isExpanded && "bg-muted/10 shadow-inner"
                        )} onClick={() => toggleRow(seller.id)}>
                          <TableCell className="pl-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-base leading-tight">{seller.user?.name}</span>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{seller.user?.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-3.5 w-3.5 text-blue-500/50" />
                              <span className="font-bold text-sm">{seller.businessInfo?.businessName || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "rounded-full uppercase tracking-widest text-[9px] font-black px-3 py-1 border-none shadow-sm",
                              seller.isApproved ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                            )}>
                              {seller.isApproved ? "Approved" : "Pending"}
                            </Badge>
                            {seller.isSuspended && <Badge className="ml-2 bg-destructive text-white rounded-full text-[9px] font-black px-3 py-1 border-none shadow-sm uppercase tracking-widest">Suspended</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-black">{seller.estimateRestaurantCount || 0}</span>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Est. Outlets</span>
                            </div>
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
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
                                className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 bg-primary/5 border border-primary/20 rounded-full transition-all"
                                onClick={() => {
                                  setSelectedSellerId(seller.id)
                                  setCommissionValue(seller.commissionRate || "")
                                  setIsCommissionDialogOpen(true)
                                }}
                              >
                                Assign
                              </Button>
                            )}
                          </TableCell>

                          <TableCell className="text-right pr-8" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className={cn(
                                  "h-9 w-9 rounded-full transition-all duration-300 shadow-sm",
                                  isExpanded ? "bg-primary text-primary-foreground rotate-180" : "bg-muted/50 hover:bg-primary/10 hover:text-primary"
                                )}
                                onClick={() => toggleRow(seller.id)}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              
                              <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-full border-muted hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm">
                                <Link href={`/admin/restaurant-sellers/${seller.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>

                              <div className="flex gap-2">
                                {!seller.isApproved && (
                                  <Button size="sm" className="h-9 rounded-full bg-green-600 hover:bg-green-700 font-bold px-4 uppercase tracking-widest text-[9px]" onClick={() => handleStatusAction(seller.id, "approve")} disabled={actionLoading === seller.id}>Approve</Button>
                                )}
                                {!seller.isSuspended ? (
                                  <Button size="sm" variant="destructive" className="h-9 rounded-full font-bold px-4 uppercase tracking-widest text-[9px] shadow-lg shadow-destructive/10" onClick={() => handleStatusAction(seller.id, "suspend")} disabled={actionLoading === seller.id}>Suspend</Button>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-9 rounded-full border-blue-500 text-blue-500 hover:bg-blue-50 font-bold px-4 uppercase tracking-widest text-[9px]" onClick={() => handleStatusAction(seller.id, "unsuspend")} disabled={actionLoading === seller.id}>Unsuspend</Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>

                      {/* Accordion Content */}
                      {expandedRow === seller.id && (
                        <TableRow className="bg-rose-50/10 hover:bg-rose-50/10 border-none">
                          <TableCell colSpan={6} className="p-0 border-none">
                            <div className="px-10 py-10 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-white rounded-[2rem] border border-rose-100/50 shadow-xl p-8">
                                <div className="flex items-center justify-between mb-8">
                                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                    <Briefcase className="h-5 w-5 text-rose-500" /> Operational Overview
                                  </h3>
                                  <Link href={`/admin/restaurant-sellers/${seller.id}`}>
                                    <Button variant="link" className="text-rose-600 font-bold text-xs uppercase tracking-widest">
                                      Open Full Dossier <ExternalLink className="ml-2 h-3 w-3" />
                                    </Button>
                                  </Link>
                                </div>
                                <RestaurantSellerDetailsView
                                  seller={seller}
                                  actionLoading={actionLoading}
                                  onApprove={id => handleStatusAction(id, "approve")}
                                  onSuspend={id => handleStatusAction(id, "suspend")}
                                  onUnsuspend={id => handleStatusAction(id, "unsuspend")}
                                  onOpenCorrection={id => setRejectDialog({ open: true, id, action: "reject" })}
                                  onOpenReject={id => setRejectDialog({ open: true, id, action: "reject" })}
                                />
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

          <div className="p-10 border-t border-slate-50 bg-slate-50/30">
            <AdminPagination
              basePath="/admin/restaurant-sellers"
              currentPage={page}
              totalPages={data?.totalPages || 1}
              totalCount={data?.totalCount || 0}
              pageSize={perPage}
              params={{ tab, search: searchQ, startDate: startParam, endDate: endParam }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feedback Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={val => !val && setRejectDialog({ open: false, id: "", action: "" })}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Administrative Feedback</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">Provide details for the seller to correct or reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 mb-2 block">Your Memo</Label>
            <Textarea
              placeholder="Type your message here..."
              className="rounded-2xl min-h-[150px] bg-slate-50 border-slate-100 focus:ring-rose-500"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full font-bold px-6" onClick={() => setRejectDialog({ open: false, id: "", action: "" })}>Cancel</Button>
            <Button className="rounded-full bg-rose-600 hover:bg-rose-700 font-bold px-8 uppercase tracking-widest text-[10px]" onClick={() => handleStatusAction(rejectDialog.id, rejectDialog.action, feedback)} disabled={!feedback || actionLoading === rejectDialog.id}>Send Feedback</Button>
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
    </div>
  )
}

function ExternalLink(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  )
}
