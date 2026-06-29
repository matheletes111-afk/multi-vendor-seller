"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Wallet, TrendingUp, RefreshCw, Hotel, ArrowDownRight, ArrowUpRight } from "lucide-react"
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
  bookingId: string | null
  guestName: string | null
  hotelName: string | null
  roomName: string | null
}

function reasonLabel(reason: string): string {
  if (reason === "BOOKING_CONFIRMED") return "Room Booking Confirmed"
  if (reason === "BOOKING_CANCELLED") return "Booking Cancelled (Debit)"
  return reason.replace(/_/g, " ")
}

export function HotelRevenueClient() {
  const [netBalance, setNetBalance] = useState<number | null>(null)
  const [balanceCreditsTotal, setBalanceCreditsTotal] = useState<number | null>(null)
  const [balanceDebitsTotal, setBalanceDebitsTotal] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/hotel-seller/revenue", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json() as Promise<{
          netBalance: number
          balanceCreditsTotal: number
          balanceDebitsTotal: number
          transactions: Tx[]
        }>
      })
      .then((data) => {
        setNetBalance(data.netBalance)
        setBalanceCreditsTotal(data.balanceCreditsTotal)
        setBalanceDebitsTotal(data.balanceDebitsTotal)
        setTransactions(data.transactions)
      })
      .catch(() => setError("Unable to load revenue data"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <PageLoader message="Loading revenue desk..." />
  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <p className="text-destructive font-semibold">{error}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Revenue</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Monitor room stay earnings and guest cancellations ledger.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl border border-slate-900 hover:bg-slate-800 transition-all shadow-md"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              Earnings (Credits) <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-950">
              {formatCurrency(balanceCreditsTotal ?? 0)}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Confirmed booking credits</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-rose-50 to-rose-100/40 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center justify-between">
              Refunded (Cancellations) <ArrowDownRight className="h-5 w-5 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-950">
              -{formatCurrency(balanceDebitsTotal ?? 0)}
            </div>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">Debited cancellation refunds</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-blue-50 via-blue-100/30 to-slate-50 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
              Net Balance <Wallet className="h-5 w-5 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-950">
              {formatCurrency(netBalance ?? 0)}
            </div>
            <p className="text-[11px] text-blue-600 font-semibold mt-1">Settled balance available</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Ledger */}
      <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Ledger History
          </CardTitle>
          <CardDescription className="text-xs">Ledger of credits and debits from booking lifecycle.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Hotel className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">No transaction logs yet</p>
              <p className="text-xs text-slate-400 mt-1">Stays booked will populate credits here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/40">
                <TableRow className="border-b-slate-100">
                  <TableHead className="py-4 pl-6">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Hotel / Suite</TableHead>
                  <TableHead className="pr-6">Guest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-50 text-slate-700 text-sm font-semibold">
                {transactions.map((t) => {
                  const isCredit = t.kind === "CREDIT"
                  return (
                    <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors border-b-slate-50">
                      <TableCell className="py-4 pl-6 text-xs text-slate-400 font-semibold">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCredit ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {isCredit ? "Credit" : "Debit"}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-black ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                        {isCredit ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs font-semibold text-slate-600 truncate">{reasonLabel(t.reason)}</TableCell>
                      <TableCell className="text-xs">
                        {t.hotelName ? (
                          <div>
                            <p className="text-slate-800 font-bold">{t.hotelName}</p>
                            <p className="text-slate-400 font-medium mt-0.5">{t.roomName ?? "Suite"}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-xs text-slate-500 font-semibold">{t.guestName ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
