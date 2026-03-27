"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { PageLoader } from "@/components/ui/page-loader"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, Wallet } from "lucide-react"

type DetailResponse = {
  id: string
  amount: number
  kind: "CREDIT"
  reason: string
  sourceLabel: string
  note: string | null
  createdAt: string
  order: { id: string; orderNumber: string } | null
  returnRequest: {
    id: string
    resolutionType: string
    status: string
    pickupStatus: string
    refundStatus: string
    customerReason: string | null
    exchangeRefundDifferenceAmount: number
    exchangeRefundDifferenceStatus: string | null
    originalLine: {
      id: string
      productNameSnapshot: string | null
      serviceNameSnapshot: string | null
    }
    replacementLine: {
      id: string
      itemStatus: string
      productNameSnapshot: string | null
      serviceNameSnapshot: string | null
      order: { id: string; orderNumber: string }
    } | null
  } | null
}

function lineName(line: { productNameSnapshot: string | null; serviceNameSnapshot: string | null }) {
  return line.productNameSnapshot || line.serviceNameSnapshot || "Line item"
}

export function WalletTransactionDetailClient({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/customer/wallet/transactions/${transactionId}`, { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (res.status === 404) throw new Error("Not found")
        if (!res.ok) throw new Error("Failed")
        return res.json() as Promise<DetailResponse>
      })
      .then(setData)
      .catch(() => setError("Could not load this transaction."))
      .finally(() => setLoading(false))
  }, [transactionId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <PageLoader message="Loading transaction…" />
  if (error || !data) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 p-6">
        <p className="text-destructive">{error ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/customer/wallet">Back to wallet</Link>
        </Button>
      </div>
    )
  }

  const rr = data.returnRequest

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1">
        <Link href="/customer/wallet">
          <ArrowLeft className="h-4 w-4" />
          Wallet
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wallet credit</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Full details for this credit and how it relates to your order and return.
        </p>
      </div>

      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-emerald-600" aria-hidden />
            {formatCurrency(data.amount)}
          </CardTitle>
          <CardDescription>{formatDate(data.createdAt)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-slate-800">Source:</span> {data.sourceLabel}
          </p>
          {data.note && (
            <p className="text-muted-foreground">
              <span className="font-medium text-slate-700">Note:</span> {data.note}
            </p>
          )}
        </CardContent>
      </Card>

      {data.order && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order</CardTitle>
            <CardDescription>The order this return or exchange is tied to.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/customer/orders/${data.order.id}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Order #{data.order.orderNumber}
            </Link>
          </CardContent>
        </Card>
      )}

      {rr && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Return / exchange</CardTitle>
            <CardDescription>
              Resolution:{" "}
              <span className="font-medium text-slate-800">
                {rr.resolutionType === "EXCHANGE" ? "Exchange" : "Refund to wallet"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Return status</p>
                <p className="mt-0.5 capitalize">{rr.status.toLowerCase().replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup</p>
                <p className="mt-0.5 capitalize">{rr.pickupStatus.toLowerCase().replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Refund</p>
                <p className="mt-0.5 capitalize">{rr.refundStatus.toLowerCase().replace(/_/g, " ")}</p>
              </div>
              {rr.resolutionType === "EXCHANGE" && rr.exchangeRefundDifferenceAmount > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Exchange price difference
                  </p>
                  <p className="mt-0.5">
                    {formatCurrency(rr.exchangeRefundDifferenceAmount)}{" "}
                    <span className="text-muted-foreground">
                      ({rr.exchangeRefundDifferenceStatus?.toLowerCase() ?? "—"})
                    </span>
                  </p>
                </div>
              )}
            </div>

            {rr.customerReason && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your reason</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{rr.customerReason}</p>
              </div>
            )}

            <div className="border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Original line</p>
              <p className="mt-1">{lineName(rr.originalLine)}</p>
            </div>

            {rr.replacementLine && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Replacement line</p>
                <p className="mt-1">{lineName(rr.replacementLine)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: {rr.replacementLine.itemStatus.toLowerCase()}
                </p>
                <p className="mt-2">
                  <Link
                    href={`/customer/orders/${rr.replacementLine.order.id}`}
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    View order #{rr.replacementLine.order.orderNumber}
                  </Link>
                  {rr.replacementLine.order.id === data.order?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(same order)</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!data.order && !rr && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No linked order or return record was found for this entry. If something looks wrong, contact support with
            this transaction ID: <code className="rounded bg-slate-100 px-1 text-xs">{data.id}</code>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
