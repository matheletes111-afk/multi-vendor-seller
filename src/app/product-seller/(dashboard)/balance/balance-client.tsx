"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Wallet } from "lucide-react"
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

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/product-seller/balance-transactions", { cache: "no-store" })
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
      .catch(() => setError("Unable to load balance and transactions"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <PageLoader message="Loading balance…" />
  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Net balance &amp; transactions</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Your net balance increases when an order line is marked delivered (your share after commission) and when you
          record exchange upgrade payments. It decreases when customers receive wallet credits from returns or cheaper
          exchanges. The list below matches those events.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-slate-700" aria-hidden />
            Net balance
          </CardTitle>
          <CardDescription>
            Credits add when lines are delivered and when you record exchange top-ups; charges apply when customers get
            wallet credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4 font-medium text-emerald-900">
              <span>Credits (+)</span>
              <span className="tabular-nums">+{formatCurrency(balanceCreditsTotal ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-4 font-medium text-rose-900">
              <span>Charges (−)</span>
              <span className="tabular-nums">−{formatCurrency(balanceDebitsTotal ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-lg font-bold text-slate-950">
              <span>Net balance</span>
              <span className="tabular-nums">{formatCurrency(netBalance ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-100 bg-violet-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">When you are debited vs credited</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-800">
          <div>
            <p className="font-semibold text-rose-900">Debit (balance goes down)</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-slate-700">
              <li>
                Customer gets a <span className="font-medium">return refund</span> to their wallet — when you mark{" "}
                <span className="font-medium">pickup complete</span>.
              </li>
              <li>
                Customer gets a <span className="font-medium">cheaper-exchange</span> difference — when the
                replacement is delivered.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-emerald-900">Credit (balance goes up)</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-slate-700">
              <li>
                You record <span className="font-medium">exchange top-up received</span> (e.g. COD collected) for a
                higher-priced replacement.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All transactions</CardTitle>
          <CardDescription>Debits and credits, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => {
                  const isCredit = t.kind === "CREDIT"
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-semibold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {isCredit ? "Credit" : "Debit"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${isCredit ? "text-emerald-800" : "text-rose-800"}`}
                      >
                        {isCredit ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm">{reasonLabel(t.reason)}</TableCell>
                      <TableCell className="text-sm">
                        {t.orderId && t.orderNumber ? (
                          <Link
                            href={`/product-seller/orders/${t.orderId}`}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            #{t.orderNumber}
                          </Link>
                        ) : t.orderNumber ? (
                          <span>#{t.orderNumber}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
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
    </div>
  )
}
