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

type WalletTx = {
  id: string
  amount: number
  kind: "CREDIT"
  reason: string
  note: string | null
  createdAt: string
  returnRequestId: string | null
  resolutionType: "REFUND" | "EXCHANGE" | null
  orderNumber: string | null
  orderId: string | null
  orderItemProductName: string | null
}

function creditReasonLabel(reason: string): string {
  if (reason === "RETURN_REFUND") return "Return refund (after seller confirms pickup)"
  if (reason === "EXCHANGE_PRICE_DIFFERENCE") return "Exchange — cheaper replacement (after delivery)"
  return reason.replace(/_/g, " ")
}

/** Short label for the list row (return vs exchange). */
function listSourceKind(tx: WalletTx): string {
  if (tx.reason === "RETURN_REFUND" || tx.resolutionType === "REFUND") return "Return"
  if (tx.reason === "EXCHANGE_PRICE_DIFFERENCE" || tx.resolutionType === "EXCHANGE") return "Exchange"
  return creditReasonLabel(tx.reason)
}

export function CustomerWalletClient() {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/customer/wallet", { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed")
        return res.json() as Promise<{ balance: number; transactions: WalletTx[] }>
      })
      .then((data) => {
        setBalance(data.balance)
        setTransactions(data.transactions)
      })
      .catch(() => setError("Unable to load wallet"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <PageLoader message="Loading wallet…" />
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
        <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Credits are added to your balance when a return refund or exchange price difference is processed. Each row
          below is money <span className="font-medium text-emerald-800">credited</span> to you.
        </p>
      </div>

      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-emerald-600" aria-hidden />
            Balance
          </CardTitle>
          <CardDescription>Spendable store credit from returns and exchanges.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-950">
            {formatCurrency(balance ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-blue-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">When you get a credit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-800">
          <p>
            <span className="font-semibold">Return (refund):</span> after the seller confirms{" "}
            <span className="font-medium">pickup</span>, your line total (including tax) is credited to this wallet.
          </p>
          <p>
            <span className="font-semibold">Exchange (cheaper replacement):</span> when the replacement line is{" "}
            <span className="font-medium">delivered</span>, the price difference vs. your original line is credited
            here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All transactions</CardTitle>
          <CardDescription>Every credit to your wallet, newest first.</CardDescription>
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
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-emerald-700">Credit</TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium text-slate-800">
                      {listSourceKind(t)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-800">
                      +{formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="max-w-[240px] text-sm">
                      <span className="block">{creditReasonLabel(t.reason)}</span>
                      {t.note && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{t.note}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.orderId && t.orderNumber ? (
                        <Link
                          href={`/customer/orders/${t.orderId}`}
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
                    <TableCell className="text-right">
                      <Link
                        href={`/customer/wallet/${t.id}`}
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
