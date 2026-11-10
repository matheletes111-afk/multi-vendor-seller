"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type Tx = {
  id: string
  amount: number
  kind: "DEBIT" | "CREDIT"
  reason: string
  note: string | null
  createdAt: string
  orderId: string | null
  orderNumber: string | null
  orderItemProductName: string | null
}

type PayoutReq = {
  id: string
  requestedAmount: number
  status: "PENDING" | "DISBURSED" | "REJECTED"
  sellerNote: string | null
  payoutMethod: string | null
  payoutAccountSnapshot: string | null
  payoutReference: string | null
  adminNote: string | null
  requestedAt: string
  disbursedAt: string | null
}

function reasonLabel(reason: string): string {
  if (reason === "ORDER_LINE_DELIVERED") return "Order line delivered"
  if (reason === "RETURN_REFUND") return "Return refund credited to customer wallet"
  if (reason === "EXCHANGE_PRICE_DIFFERENCE") return "Cheaper exchange — difference credited to customer wallet"
  if (reason === "EXCHANGE_TOP_UP_COLLECTED") return "Exchange upgrade — top-up you recorded as received"
  return reason.replace(/_/g, " ")
}

export function BalanceClient() {
  const [netBalance, setNetBalance] = useState<number | null>(null)
  const [balanceCreditsTotal, setBalanceCreditsTotal] = useState<number | null>(null)
  const [balanceDebitsTotal, setBalanceDebitsTotal] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Payout states
  const [pendingPayout, setPendingPayout] = useState<PayoutReq | null>(null)
  const [payoutHistory, setPayoutHistory] = useState<PayoutReq[]>([])
  const [payoutAccountSnapshot, setPayoutAccountSnapshot] = useState<string | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [sellerNote, setSellerNote] = useState("")
  const [submittingPayout, setSubmittingPayout] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch("/api/product-seller/balance-transactions", { cache: "no-store" }).then((res) => {
        if (!res.ok) throw new Error("Failed to load balance")
        return res.json()
      }),
      fetch("/api/product-seller/payout-requests", { cache: "no-store" }).then((res) => {
        if (!res.ok) return { pendingRequest: null, history: [] }
        return res.json()
      }),
    ])
      .then(([balanceData, payoutData]) => {
        setNetBalance(balanceData.netBalance)
        setBalanceCreditsTotal(balanceData.balanceCreditsTotal)
        setBalanceDebitsTotal(balanceData.balanceDebitsTotal)
        setTransactions(balanceData.transactions)

        setPendingPayout(payoutData.pendingRequest || null)
        setPayoutHistory(payoutData.history || [])
        setPayoutAccountSnapshot(payoutData.payoutAccountSnapshot || null)
      })
      .catch(() => setError("Unable to load balance and transactions"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleRequestPayout = async () => {
    if (!netBalance || netBalance <= 0) return
    setSubmittingPayout(true)
    setPayoutMsg(null)

    try {
      const res = await fetch("/api/product-seller/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerNote }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit payout request")
      }
      setPayoutMsg({ type: "success", text: "Payout request submitted successfully to Admin!" })
      setIsRequestModalOpen(false)
      setSellerNote("")
      load()
    } catch (err: any) {
      setPayoutMsg({ type: "error", text: err.message || "Failed to submit request" })
    } finally {
      setSubmittingPayout(false)
    }
  }

  if (loading) return <PageLoader message="Loading balance & payouts…" />
  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const currentNet = netBalance ?? 0

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Revenue &amp; Payout Desk</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Monitor earnings from delivered orders, track yet-to-pay balance, and request disbursements to your bank or mobile wallet.
          </p>
        </div>
        {pendingPayout ? (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Payout Pending Admin
          </Badge>
        ) : currentNet > 0 ? (
          <Button
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 px-5"
          >
            <Send className="w-4 h-4 mr-2" /> Request Payout to Admin
          </Button>
        ) : (
          <Button disabled variant="outline" className="rounded-xl font-bold text-xs opacity-60">
            No Balance to Disburse
          </Button>
        )}
      </div>

      {payoutMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            payoutMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{payoutMsg.text}</span>
          <Button variant="ghost" size="sm" onClick={() => setPayoutMsg(null)} className="h-6 text-[10px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* Pending Payout Banner */}
      {pendingPayout && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-amber-950">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
              <h3 className="font-bold text-sm">Payout Request Pending Disbursement</h3>
            </div>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              You requested a disbursement of <strong className="font-bold">{formatCurrency(pendingPayout.requestedAmount)}</strong> on{" "}
              {formatDate(pendingPayout.requestedAt)}. Admin is reviewing and will disburse funds to your registered account.
            </p>
            {pendingPayout.payoutAccountSnapshot && (
              <p className="text-[11px] text-amber-800/70 font-mono">
                Destination: {pendingPayout.payoutAccountSnapshot}
              </p>
            )}
          </div>
          <Badge className="bg-amber-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shrink-0 shadow-sm">
            Pending Admin Action
          </Badge>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Earned */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              Total Net Earned <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-950 tabular-nums">
              +{formatCurrency(balanceCreditsTotal ?? 0)}
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">Delivered orders + top-ups</p>
          </CardContent>
        </Card>

        {/* Total Charges / Disbursed */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-rose-50 to-rose-100/40 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center justify-between">
              Debits / Paid Out <ArrowDownRight className="h-5 w-5 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-950 tabular-nums">
              −{formatCurrency(balanceDebitsTotal ?? 0)}
            </div>
            <p className="text-[11px] text-rose-700 font-semibold mt-1">Wallet returns & refunds</p>
          </CardContent>
        </Card>

        {/* Yet to Pay / Available Net Balance */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl overflow-hidden relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              Available Balance (Yet to Pay) <Wallet className="h-5 w-5 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400 tabular-nums">
              {formatCurrency(currentNet)}
            </div>
            <p className="text-[11px] text-slate-300 font-medium mt-1">Available to request disbursement</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Requests History */}
      {payoutHistory.length > 0 && (
        <Card className="rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Payout Requests &amp; Disbursements History
            </CardTitle>
            <CardDescription className="text-xs">
              Audit trail of disbursement requests submitted to platform administration.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/40">
                <TableRow className="border-b-slate-100 text-xs">
                  <TableHead className="py-3 pl-6">Requested Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Destination Account</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Payout Reference / Note</TableHead>
                  <TableHead className="pr-6">Disbursed Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-50 text-slate-700 text-xs font-semibold">
                {payoutHistory.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/30 transition-colors">
                    <TableCell className="py-3.5 pl-6 text-slate-500 font-medium whitespace-nowrap">
                      {formatDate(p.requestedAt)}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900 tabular-nums text-sm">
                      {formatCurrency(p.requestedAmount)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-slate-600 font-mono text-[11px]">
                      {p.payoutAccountSnapshot || p.payoutMethod || "Registered Bank/Wallet"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.status === "DISBURSED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : p.status === "PENDING"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {p.status === "DISBURSED" ? "Disbursed" : p.status === "PENDING" ? "Pending" : "Rejected"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-slate-600">
                      {p.payoutReference ? (
                        <span className="font-mono font-bold text-emerald-700">Ref: {p.payoutReference}</span>
                      ) : p.adminNote ? (
                        <span className="italic">{p.adminNote}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-slate-500 whitespace-nowrap">
                      {p.disbursedAt ? formatDate(p.disbursedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ledger History */}
      <Card className="rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Itemized Ledger Transactions
          </CardTitle>
          <CardDescription className="text-xs">
            Automatic credits when order lines are delivered; debits when return refunds occur.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/40">
                <TableRow className="border-b-slate-100 text-xs">
                  <TableHead className="py-3 pl-6">Date</TableHead>
                  <TableHead className="text-right">Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="pr-6">Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-50 text-slate-700 text-xs font-semibold">
                {transactions.map((t) => {
                  const isCredit = t.kind === "CREDIT"
                  return (
                    <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-3.5 pl-6 whitespace-nowrap text-slate-500">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-bold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {isCredit ? "Credit" : "Debit"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-black tabular-nums text-sm ${isCredit ? "text-emerald-800" : "text-rose-800"}`}
                      >
                        {isCredit ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-slate-800">{reasonLabel(t.reason)}</TableCell>
                      <TableCell>
                        {t.orderId && t.orderNumber ? (
                          <Link
                            href={`/product-seller/orders/${t.orderId}`}
                            className="font-bold text-primary underline-offset-2 hover:underline"
                          >
                            #{t.orderNumber}
                          </Link>
                        ) : t.orderNumber ? (
                          <span>#{t.orderNumber}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="pr-6 max-w-[200px] truncate text-slate-600">
                        {t.orderItemProductName ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request Payout Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] border border-slate-100 max-w-md w-full overflow-hidden shadow-2xl p-6 sm:p-8 space-y-5 relative">
            <div>
              <h3 className="text-lg font-black text-slate-900">Request Payout to Admin</h3>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                Your available balance will be submitted for platform administration review and disbursement.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Requested Amount:</span>
                <span className="text-lg font-black text-emerald-600 tabular-nums">
                  {formatCurrency(currentNet)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium block">Destination Account:</span>
                <span className="font-mono text-[11px] font-bold text-slate-800 block mt-0.5">
                  {payoutAccountSnapshot || "Registered account on file"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sellerNote" className="text-xs font-bold text-slate-700 block">
                Seller Note / Remark (Optional):
              </label>
              <textarea
                id="sellerNote"
                rows={2}
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
                placeholder="e.g. Please send to AfriMoney mobile wallet"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRequestModalOpen(false)}
                disabled={submittingPayout}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestPayout}
                disabled={submittingPayout}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                {submittingPayout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Confirm Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
