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
import { Users, CheckCircle, AlertCircle, Ban, Eye, Building2, Search, X, Calendar, Filter, ChevronDown } from "lucide-react"
import { HotelSellerDetailsView } from "@/components/admin/sellers/hotel-seller-details-view"

export function HotelSellersClient() {
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
  
  const [selectedSeller, setSelectedSeller] = useState<any>(null)
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; action: string }>({ open: false, id: "", action: "" })
  const [feedback, setFeedback] = useState("")

  const loadSellers = useCallback(() => {
    setLoading(true)
    const tabQs = tab === "all" ? "" : `&tab=${encodeURIComponent(tab)}`
    const searchQs = searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""
    const startQs = startParam ? `&startDate=${encodeURIComponent(startParam)}` : ""
    const endQs = endParam ? `&endDate=${encodeURIComponent(endParam)}` : ""

    fetch(`/api/admin/hotel-sellers?page=${page}&perPage=${perPage}${tabQs}${searchQs}${startQs}${endQs}`)
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
    router.push(buildAdminPageUrl("/admin/hotel-sellers", 1, params))
  }

  const handleClear = () => {
    setSearchInput("")
    setStartDate("")
    setEndDate("")
    setLocalTab("all")
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
      if (!res.ok) throw new Error("Failed to update status")
      
      if (selectedSeller?.id === id) {
         setSelectedSeller(null)
      }
      setRejectDialog({ open: false, id: "", action: "" })
      setFeedback("")
      loadSellers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading && !data) return <PageLoader message="Loading hotel sellers..." />

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Hotel Seller Management</h1>
          <p className="text-muted-foreground">Manage and approve hotel partners.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">{data?.totalCount || 0} Total Hotels</Badge>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[250px] space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Name, email, business..." 
                  className="pl-9 rounded-xl" 
                  value={searchInput} 
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Status</Label>
              <Select value={localTab} onValueChange={setLocalTab}>
                <SelectTrigger className="w-[180px] rounded-xl">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="rounded-xl px-6 h-10">Search</Button>
              <Button variant="outline" onClick={handleClear} className="rounded-xl h-10">Reset</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-8">Partner</TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rooms (Est.)</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.sellers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No hotel sellers found.</TableCell></TableRow>
              ) : (
                data?.sellers.map((seller: any) => (
                  <TableRow key={seller.id} className="group hover:bg-muted/20 border-b cursor-pointer" onClick={() => setSelectedSeller(seller)}>
                    <TableCell className="pl-8 py-4">
                      <div className="font-medium">{seller.user?.name}</div>
                      <div className="text-xs text-muted-foreground">{seller.user?.email}</div>
                    </TableCell>
                    <TableCell className="font-medium">{seller.businessInfo?.businessName || "—"}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-full uppercase tracking-tighter text-[10px] px-2.5",
                        seller.isApproved ? "bg-green-500" : "bg-blue-500"
                      )}>
                        {seller.isApproved ? "Approved" : "Pending"}
                      </Badge>
                      {seller.isSuspended && <Badge className="ml-1 bg-red-500 rounded-full text-[10px] px-2.5 uppercase tracking-tighter">Suspended</Badge>}
                    </TableCell>
                    <TableCell>{seller.estimateRoomCount || 0}</TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-primary">{seller.subscription?.plan?.displayName || "None"}</span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setSelectedSeller(seller)}>
                           <Eye className="h-4 w-4" />
                        </Button>
                        {!seller.isApproved && (
                          <Button size="sm" className="h-8 rounded-full bg-green-600 hover:bg-green-700" onClick={() => handleStatusAction(seller.id, "approve")} disabled={actionLoading === seller.id}>Approve</Button>
                        )}
                        {!seller.isSuspended ? (
                          <Button size="sm" variant="destructive" className="h-8 rounded-full" onClick={() => handleStatusAction(seller.id, "suspend")} disabled={actionLoading === seller.id}>Suspend</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 rounded-full border-blue-500 text-blue-500" onClick={() => handleStatusAction(seller.id, "unsuspend")} disabled={actionLoading === seller.id}>Unsuspend</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-6 border-t">
            <AdminPagination 
              basePath="/admin/hotel-sellers" 
              currentPage={page} 
              totalPages={data?.totalPages || 1} 
              totalCount={data?.totalCount || 0} 
              pageSize={perPage} 
              params={{ tab, search: searchQ, startDate: startParam, endDate: endParam }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedSeller} onOpenChange={val => !val && setSelectedSeller(null)}>
        <SheetContent side="right" className="w-[95%] sm:w-[600px] md:w-[800px] xl:w-[1000px] p-0 border-l-0 shadow-2xl">
          <SheetHeader className="p-6 border-b bg-muted/20">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
               <Building2 className="h-5 w-5 text-blue-600" /> Hotel Partner Details
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)] overflow-y-auto p-8 bg-slate-50/50">
             <HotelSellerDetailsView 
                seller={selectedSeller}
                actionLoading={actionLoading}
                onApprove={id => handleStatusAction(id, "approve")}
                onSuspend={id => handleStatusAction(id, "suspend")}
                onUnsuspend={id => handleStatusAction(id, "unsuspend")}
                onOpenCorrection={id => setRejectDialog({ open: true, id, action: "reject" })}
                onOpenReject={id => setRejectDialog({ open: true, id, action: "reject" })}
             />
          </div>
        </SheetContent>
      </Sheet>

      {/* Feedback Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={val => !val && setRejectDialog({ open: false, id: "", action: "" })}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Administrative Feedback</DialogTitle>
            <DialogDescription>Provide details for the seller to correct or reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <Label className="text-xs font-bold uppercase mb-2 block">Your Memo</Label>
             <Textarea 
                placeholder="Type your message here..." 
                className="rounded-2xl min-h-[120px]" 
                value={feedback} 
                onChange={e => setFeedback(e.target.value)}
             />
          </div>
          <DialogFooter>
             <Button variant="outline" className="rounded-full" onClick={() => setRejectDialog({ open: false, id: "", action: "" })}>Cancel</Button>
             <Button className="rounded-full bg-red-600 hover:bg-red-700 font-bold" onClick={() => handleStatusAction(rejectDialog.id, rejectDialog.action, feedback)} disabled={!feedback || actionLoading === rejectDialog.id}>Send Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
