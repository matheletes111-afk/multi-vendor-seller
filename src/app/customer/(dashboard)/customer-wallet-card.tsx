"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Loader2, Wallet } from "lucide-react"

export function CustomerWalletCard() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/customer/wallet", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load wallet")
        return res.json() as Promise<{ balance: number }>
      })
      .then((data) => {
        setBalance(data.balance)
      })
      .catch(() => setError("Unable to load wallet"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-emerald-600" aria-hidden />
          Wallet balance
        </CardTitle>
        <CardDescription>
          Credits from returns (after pickup) and from exchanges when the replacement costs less. Full history is on your
          wallet page.
        </CardDescription>
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
              asChild
            >
              <Link href="/customer/wallet">View credits &amp; transactions</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
