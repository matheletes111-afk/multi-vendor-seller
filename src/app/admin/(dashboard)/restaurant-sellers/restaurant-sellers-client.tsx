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
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-1000">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-rose-50 rounded-3xl">
            <Utensils className="h-8 w-8 text-rose-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Restaurant Partners</h1>
            <p className="text-slate-500 font-medium tracking-tight">Review and manage culinary partner applications.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Network</p>
            <p className="text-2xl font-black text-rose-600">{data?.totalCount || 0} Outlets</p>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="pb-8 pt-10 px-10">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[300px] space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Universal Search</Label>
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-300" />
                <Input
                  placeholder="Partner name, brand, or email..."
                  className="pl-12 rounded-2xl h-12 bg-slate-50 border-slate-100 focus:ring-rose-500 text-sm font-medium"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="w-[200px] space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Lifecycle State</Label>
              <Select value={localTab} onValueChange={setLocalTab}>
                <SelectTrigger className="rounded-2xl h-12 bg-slate-50 border-slate-100 font-bold text-slate-700">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100">
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="pending">Awaiting Review</SelectItem>
                  <SelectItem value="approved">Active Partners</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 h-12">
              <Button onClick={handleSearch} className="rounded-2xl px-8 h-full bg-rose-600 hover:bg-rose-700 font-bold text-xs uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-rose-100">Apply Filter</Button>
              <Button variant="outline" onClick={handleClear} className="rounded-2xl h-full border-slate-200 hover:bg-slate-50 font-bold text-xs uppercase tracking-widest">Reset</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="pl-10 h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Partner Details</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Business Identity</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Standing</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Outlets (Est.)</TableHead>
                  <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Commission</TableHead>
                  <TableHead className="text-right pr-10 h-14 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.sellers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-medium">No restaurant partners found matching your criteria.</TableCell></TableRow>
                ) : (
                  data?.sellers.map((seller: any) => (
                    <Fragment key={seller.id}>
                      <TableRow
                        className={cn(
                          "group border-b border-slate-50 cursor-pointer transition-colors",
                          expandedRow === seller.id ? "bg-rose-50/30" : "hover:bg-slate-50/50"
                        )}
                        onClick={() => toggleRow(seller.id)}
                      >
                        <TableCell className="pl-10 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 font-black text-sm">
                              {seller.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 leading-tight">{seller.user?.name}</div>
                              <div className="text-[11px] text-slate-500 font-medium">{seller.user?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-700">{seller.businessInfo?.businessName || "—"}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{seller.businessInfo?.businessType || "Retail Partner"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "rounded-full uppercase tracking-widest text-[9px] font-black px-3 py-1 border-none",
                            seller.isApproved ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                          )}>
                            {seller.isApproved ? "Approved" : "Pending"}
                          </Badge>
                          {seller.isSuspended && <Badge className="ml-2 bg-rose-600 text-white rounded-full text-[9px] px-3 py-1 border-none font-black uppercase tracking-widest">Suspended</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700">{seller.estimateRestaurantCount || 0}</span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest opacity-60">Est. Outlets</span>
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

                        <TableCell className="text-right pr-10" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {!seller.isApproved && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-[9px] font-black uppercase tracking-widest px-4"
                                  onClick={() => handleStatusAction(seller.id, "approve")}
                                  disabled={actionLoading === seller.id}
                                >
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-8 rounded-full text-[9px] font-black uppercase tracking-widest px-4"
                                  onClick={() => setRejectDialog({ open: true, id: seller.id, action: "reject" })}
                                  disabled={actionLoading === seller.id}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {seller.isApproved && (
                               <Badge variant="outline" className="h-8 rounded-full border-emerald-100 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-4 flex items-center gap-2 border-none">
                                  <CheckCircle className="h-3 w-3" /> Verified
                               </Badge>
                            )}
                            <div className="w-px h-8 bg-slate-100 mx-1" />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-slate-400 hover:text-rose-600"
                              asChild
                            >
                              <Link href={`/admin/restaurant-sellers/${seller.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-9 w-9 rounded-xl transition-all",
                                expandedRow === seller.id ? "bg-rose-100 text-rose-600" : "text-slate-300 hover:text-rose-600"
                              )}
                              onClick={() => toggleRow(seller.id)}
                            >
                              {expandedRow === seller.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
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
                  ))
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
