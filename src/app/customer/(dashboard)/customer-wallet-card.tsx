"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Loader2, Wallet } from "lucide-react"
import Link from "next/link"

type WalletTx = {
  id: string
  amount: number
  reason: string
  note: string | null
  createdAt: string
  orderNumber: string | null
  orderId: string | null
  orderItemProductName: string | null
}

export function CustomerWalletCard() {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/customer/wallet", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load wallet")
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
    load()
  }, [load])

  const exchangeCredits = transactions.filter((t) => t.reason === "EXCHANGE_PRICE_DIFFERENCE")

  return (
    <>
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-emerald-600" aria-hidden />
            Wallet balance
          </CardTitle>
          <CardDescription>Credit from exchanges when your replacement cost less than the original item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <>
              <p className="text-3xl font-bold tracking-tight text-emerald-950 tabular-nums">
                {formatCurrency(balance ?? 0)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-emerald-200 bg-white hover:bg-emerald-50"
                onClick={() => setDialogOpen(true)}
              >
                See more
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Exchange wallet credits</DialogTitle>
            <DialogDescription>
              Amounts credited when a replacement item cost less than your original line (after replacement delivery).
            </DialogDescription>
          </DialogHeader>
          {exchangeCredits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No exchange credits yet. When you complete an exchange with a cheaper replacement, the difference appears
              here after delivery.
            </p>
          ) : (
            <ul className="space-y-3 border-t pt-4">
              {exchangeCredits.map((tx) => (
                <li
                  key={tx.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-emerald-800 tabular-nums">{formatCurrency(tx.amount)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </span>
                  </div>
                  {tx.orderNumber && (
                    <p className="text-xs text-slate-600">
                      Order{" "}
                      {tx.orderId ? (
                        <Link
                          href={`/customer/orders/${tx.orderId}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setDialogOpen(false)}
                        >
                          #{tx.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-medium">#{tx.orderNumber}</span>
                      )}
                    </p>
                  )}
                  {tx.orderItemProductName && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{tx.orderItemProductName}</p>
                  )}
                  {tx.note && <p className="text-[11px] text-muted-foreground italic">{tx.note}</p>}
                </li>
              ))}
            </ul>
          )}
          {transactions.length > exchangeCredits.length && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              Other wallet activity ({transactions.length - exchangeCredits.length} transaction
              {transactions.length - exchangeCredits.length === 1 ? "" : "s"}) is not shown in this list. Total balance
              includes all credits.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
