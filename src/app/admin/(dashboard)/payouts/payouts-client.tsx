"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AdminDisburseModal } from "@/components/admin/admin-disburse-modal"
import {
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Store,
  Building2,
  Utensils,
  Briefcase,
  User,
  Phone,
  Mail,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Truck,
} from "lucide-react"

type PayoutRequestItem = {
  id: string
  sellerSector: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  sellerId: string
  requestedAmount: number
  status: string
  sellerNote: string | null
  payoutMethod: string | null
  payoutAccountSnapshot: string | null
  payoutReference: string | null
  adminNote: string | null
  requestedAt: string
  disbursedAt: string | null
  disbursedByAdminId: string | null
  sellerStoreName: string
  sellerOwnerName: string
  sellerEmail: string
  sellerPhone?: string
  currentNetBalance?: number
}

type YetToPaySellerItem = {
  sellerId: string
  sellerSector: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | "RIDER"
  storeName: string
  ownerName: string
  email: string
  phone: string | null
  netBalance: number
  payoutMethod: string
  payoutAccountSnapshot: string
  hasPendingRequest: boolean
}

type PayoutSummary = {
  totalYetToPay: number
  totalPendingRequested: number
  pendingCount: number
  totalDisbursed: number
  disbursedCount: number
  totalYetToPaySellersCount: number
}

export function AdminPayoutsClient() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"PENDING" | "YET_TO_PAY" | "HISTORY">("PENDING")
  const [summary, setSummary] = useState<PayoutSummary>({
    totalYetToPay: 0,
    totalPendingRequested: 0,
    pendingCount: 0,
    totalDisbursed: 0,
    disbursedCount: 0,
    totalYetToPaySellersCount: 0,
  })
  const [pendingRequests, setPendingRequests] = useState<PayoutRequestItem[]>([])
  const [yetToPaySellers, setYetToPaySellers] = useState<YetToPaySellerItem[]>([])
  const [disbursedHistory, setDisbursedHistory] = useState<PayoutRequestItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sectorFilter, setSectorFilter] = useState<string>("ALL")

  // Modal State
  const [disburseModal, setDisburseModal] = useState<{
    isOpen: boolean
    sellerSector: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT" | "RIDER"
    sellerId: string
    sellerName: string
    suggestedAmount: number
    payoutRequestId?: string
    defaultPayoutMethod?: string
    defaultAccountSnapshot?: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/payouts")
      const json = await res.json()
      if (json.success && json.data) {
        setSummary(json.data.summary)
        setPendingRequests(json.data.pendingRequests)
        setYetToPaySellers(json.data.yetToPaySellers)
        setDisbursedHistory(json.data.disbursedHistory)
      }
    } catch (err) {
      console.error("Failed to load admin payouts:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const renderSectorBadge = (sector: string) => {
    switch (sector) {
      case "PRODUCT":
        return (
          <Badge className="bg-sky-50 text-sky-700 border-sky-200 font-bold text-[10px] gap-1">
            <Store className="w-3 h-3" /> Product
          </Badge>
        )
      case "SERVICE":
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[10px] gap-1">
            <Briefcase className="w-3 h-3" /> Service
          </Badge>
        )
      case "HOTEL":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] gap-1">
            <Building2 className="w-3 h-3" /> Hotel
          </Badge>
        )
      case "RESTAURANT":
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] gap-1">
            <Utensils className="w-3 h-3" /> Restaurant
          </Badge>
        )
      case "RIDER":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1">
            <Truck className="w-3 h-3" /> Rider
          </Badge>
        )
      default:
        return <Badge variant="outline">{sector}</Badge>
    }
  }

  // Filter helper
  const filterBySearchAndSector = <T extends { sellerSector?: string; storeName?: string; sellerStoreName?: string; ownerName?: string; sellerOwnerName?: string }>(items: T[]) => {
    return items.filter((item) => {
      const sectorMatch = sectorFilter === "ALL" || (item.sellerSector || "") === sectorFilter
      if (!sectorMatch) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const name = (item.storeName || item.sellerStoreName || "").toLowerCase()
      const owner = (item.ownerName || item.sellerOwnerName || "").toLowerCase()
      return name.includes(q) || owner.includes(q)
    })
  }

  if (loading && !summary.totalYetToPay && pendingRequests.length === 0) {
    return <PageLoader message="Loading seller payouts and liabilities..." />
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Seller Payouts & Liabilities
          </h1>
          <p className="text-sm font-semibold text-muted-foreground mt-0.5">
            Reconcile ledger liabilities across all 4 sectors and disburse vendor payouts.
          </p>
        </div>
        <Button
          onClick={fetchData}
          variant="outline"
          size="sm"
          className="rounded-xl font-bold gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Desk
        </Button>
      </div>

      {/* Top 3 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Yet to Pay Liabilities */}
        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-amber-500/10 via-background to-background border-l-4 border-l-amber-500 p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Total Yet to Pay Liabilities
              </p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                {formatCurrency(summary.totalYetToPay)}
              </p>
              <p className="text-xs text-muted-foreground font-semibold">
                Across {summary.totalYetToPaySellersCount} vendors with positive balances
              </p>
            </div>
            <div className="p-3 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-2xl shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Card 2: Pending Payout Requests */}
        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-blue-500/10 via-background to-background border-l-4 border-l-blue-500 p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Pending Payout Requests
              </p>
              <p className="text-2xl sm:text-3xl font-black text-blue-600 tabular-nums">
                {summary.pendingCount}
              </p>
              <p className="text-xs text-muted-foreground font-semibold">
                Total Requested: {formatCurrency(summary.totalPendingRequested)}
              </p>
            </div>
            <div className="p-3 bg-blue-500/15 text-blue-600 rounded-2xl shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Card 3: Total Disbursed */}
        <Card className="rounded-3xl border-none shadow-md bg-gradient-to-br from-emerald-500/10 via-background to-background border-l-4 border-l-emerald-500 p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Disbursed to Date
              </p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums">
                {formatCurrency(summary.totalDisbursed)}
              </p>
              <p className="text-xs text-muted-foreground font-semibold">
                {summary.disbursedCount} payouts successfully settled
              </p>
            </div>
            <div className="p-3 bg-emerald-500/15 text-emerald-600 rounded-2xl shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "PENDING"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-muted-foreground hover:text-slate-800"
            }`}
          >
            🔔 Pending Requests ({summary.pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("YET_TO_PAY")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "YET_TO_PAY"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-muted-foreground hover:text-slate-800"
            }`}
          >
            All Sellers with Yet to Pay ({summary.totalYetToPaySellersCount})
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "HISTORY"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-muted-foreground hover:text-slate-800"
            }`}
          >
            Disbursement History ({summary.disbursedCount})
          </button>
        </div>

        {/* Sector and Search filters */}
        <div className="flex items-center gap-2">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="rounded-xl border border-muted bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">All Sectors</option>
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
            <option value="HOTEL">Hotel</option>
            <option value="RESTAURANT">Restaurant</option>
            <option value="RIDER">Rider</option>
          </select>
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor..."
              className="pl-8 h-9 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Pending Payout Requests */}
      {activeTab === "PENDING" && (
        <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-background">
          <CardHeader className="bg-muted/20 border-b border-muted/30 py-4 px-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> Pending Vendor Payout Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Vendors who have initiated a payout request for admin disbursement.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filterBySearchAndSector(pendingRequests).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm font-semibold space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p>No pending payout requests matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-muted/30">
                    <tr>
                      <th className="py-3 px-5">Vendor & Sector</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Current Net Balance</th>
                      <th className="py-3 px-4">Requested Amount</th>
                      <th className="py-3 px-4">Payout Method & Account</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30 font-semibold text-slate-700 dark:text-slate-200">
                    {filterBySearchAndSector(pendingRequests).map((req) => (
                      <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {req.sellerStoreName}
                            </p>
                            <div>{renderSectorBadge(req.sellerSector)}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 space-y-0.5 text-muted-foreground text-[11px]">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{req.sellerOwnerName}</p>
                          <p className="truncate max-w-xs">{req.sellerEmail}</p>
                          {req.sellerPhone && <p className="font-mono text-primary">{req.sellerPhone}</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold tabular-nums text-slate-800">
                            {formatCurrency(req.currentNetBalance ?? req.requestedAmount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-emerald-600 text-sm tabular-nums">
                            {formatCurrency(req.requestedAmount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 space-y-1 max-w-xs">
                          <Badge variant="outline" className="font-bold text-[10px]">
                            {req.payoutMethod || "AfriMoney"}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground truncate" title={req.payoutAccountSnapshot || ""}>
                            {req.payoutAccountSnapshot || "No snapshot provided"}
                          </p>
                          {req.sellerNote && (
                            <p className="text-[10px] text-slate-500 italic bg-muted/40 p-1 rounded">
                              Note: {req.sellerNote}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                          {formatDate(req.requestedAt)}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDisburseModal({
                                isOpen: true,
                                sellerSector: req.sellerSector,
                                sellerId: req.sellerId,
                                sellerName: req.sellerStoreName,
                                suggestedAmount: req.requestedAmount,
                                payoutRequestId: req.id,
                                defaultPayoutMethod: req.payoutMethod || "AfriMoney",
                                defaultAccountSnapshot: req.payoutAccountSnapshot || undefined,
                              })
                            }
                            className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1"
                          >
                            <Banknote className="w-3.5 h-3.5" /> Disburse Funds
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: All Sellers with Yet to Pay Balance */}
      {activeTab === "YET_TO_PAY" && (
        <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-background">
          <CardHeader className="bg-muted/20 border-b border-muted/30 py-4 px-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Banknote className="w-4 h-4 text-amber-600" /> Active Sellers with Yet to Pay Liabilities
            </CardTitle>
            <CardDescription className="text-xs">
              Every vendor across all 4 sectors currently holding a positive net balance in our system.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filterBySearchAndSector(yetToPaySellers).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm font-semibold space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p>No vendors with outstanding liabilities found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-muted/30">
                    <tr>
                      <th className="py-3 px-5">Vendor & Sector</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Outstanding Net Balance</th>
                      <th className="py-3 px-4">Registered Payout Method</th>
                      <th className="py-3 px-4">Account Snapshot</th>
                      <th className="py-3 px-4 text-center">Request Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30 font-semibold text-slate-700 dark:text-slate-200">
                    {filterBySearchAndSector(yetToPaySellers).map((seller) => (
                      <tr key={seller.sellerId} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {seller.storeName}
                            </p>
                            <div>{renderSectorBadge(seller.sellerSector)}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 space-y-0.5 text-muted-foreground text-[11px]">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{seller.ownerName}</p>
                          <p className="truncate max-w-xs">{seller.email}</p>
                          {seller.phone && <p className="font-mono text-primary">{seller.phone}</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-emerald-600 text-sm tabular-nums">
                            {formatCurrency(seller.netBalance)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="font-bold text-[10px]">
                            {seller.payoutMethod}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-muted-foreground text-[11px] truncate" title={seller.payoutAccountSnapshot}>
                          {seller.payoutAccountSnapshot}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {seller.hasPendingRequest ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[9px] animate-pulse">
                              🔔 Pending Request
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Direct Payout Available
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDisburseModal({
                                isOpen: true,
                                sellerSector: seller.sellerSector,
                                sellerId: seller.sellerId,
                                sellerName: seller.storeName,
                                suggestedAmount: seller.netBalance,
                                defaultPayoutMethod: seller.payoutMethod,
                                defaultAccountSnapshot: seller.payoutAccountSnapshot,
                              })
                            }
                            className="rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm gap-1"
                          >
                            <Banknote className="w-3.5 h-3.5" /> Disburse Funds
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Disbursement History */}
      {activeTab === "HISTORY" && (
        <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-background">
          <CardHeader className="bg-muted/20 border-b border-muted/30 py-4 px-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed Disbursements Audit Trail
            </CardTitle>
            <CardDescription className="text-xs">
              Complete historical record of all payouts disbursed with bank reference numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filterBySearchAndSector(disbursedHistory).length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm font-semibold">
                <p>No historical disbursements found matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-muted/30">
                    <tr>
                      <th className="py-3 px-5">Reference ID</th>
                      <th className="py-3 px-4">Vendor & Sector</th>
                      <th className="py-3 px-4">Amount Disbursed</th>
                      <th className="py-3 px-4">Payout Method & Account</th>
                      <th className="py-3 px-4">Admin Note</th>
                      <th className="py-3 px-5 text-right">Disbursed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30 font-semibold text-slate-700 dark:text-slate-200">
                    {filterBySearchAndSector(disbursedHistory).map((item) => (
                      <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="font-mono font-bold text-emerald-600 text-xs bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                            {item.payoutReference || "N/A"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {item.sellerStoreName}
                            </p>
                            <div>{renderSectorBadge(item.sellerSector)}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-slate-900 dark:text-white text-sm tabular-nums">
                            {formatCurrency(item.requestedAmount)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 space-y-1 max-w-xs">
                          <Badge variant="outline" className="font-bold text-[10px]">
                            {item.payoutMethod || "Bank"}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground truncate" title={item.payoutAccountSnapshot || ""}>
                            {item.payoutAccountSnapshot || "N/A"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-[11px] max-w-xs">
                          {item.adminNote || "—"}
                        </td>
                        <td className="py-3.5 px-5 text-right text-muted-foreground text-[11px]">
                          {item.disbursedAt ? formatDate(item.disbursedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disburse Modal */}
      {disburseModal && (
        <AdminDisburseModal
          isOpen={disburseModal.isOpen}
          onClose={() => setDisburseModal(null)}
          onSuccess={() => {
            fetchData()
            setDisburseModal(null)
          }}
          sellerSector={disburseModal.sellerSector}
          sellerId={disburseModal.sellerId}
          sellerName={disburseModal.sellerName}
          suggestedAmount={disburseModal.suggestedAmount}
          payoutRequestId={disburseModal.payoutRequestId}
          defaultPayoutMethod={disburseModal.defaultPayoutMethod}
          defaultAccountSnapshot={disburseModal.defaultAccountSnapshot}
        />
      )}
    </div>
  )
}

