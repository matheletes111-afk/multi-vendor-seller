"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency } from "@/lib/utils"
import { Package, ShoppingCart, DollarSign, AlertCircle, ArrowRight, Wallet } from "lucide-react"

type Overview = {
  subscription: { plan: { name: string } } | null
  commissionRate: number | null
  isGlobalRate: boolean
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  totalRevenueFormatted: string
  netBalance: number
  netBalanceFormatted: string
  balanceCreditsTotal: number
  balanceDebitsTotal: number
}

export function ProductSellerPageClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const res = await fetch("/api/product-seller/overview", { signal: controller.signal, cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load")
        const json = (await res.json()) as Overview
        setData(json)
        setError(null)
      } catch (e: any) {
        if (e?.name === "AbortError") return
        setError("Failed to load dashboard")
      }
    }

    let isMounted = true
    const run = async () => {
      if (!isMounted) return
      if (document.visibilityState === "hidden") return
      await load()
    }

    void run()
    const intervalId = window.setInterval(() => {
      void run()
    }, 30000)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void run()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      isMounted = false
      controller.abort()
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }
  if (!data) return <PageLoader message="Loading dashboard…" />

  const {
    subscription,
    commissionRate,
    isGlobalRate,
    totalProducts,
    totalOrders,
    totalRevenueFormatted,
    netBalanceFormatted,
    balanceCreditsTotal,
    balanceDebitsTotal,
  } = data

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your product seller account
        </p>
      </div>

      {!subscription && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle>Subscription Required</AlertTitle>
          <AlertDescription className="mt-2">
            You need an active subscription to use the seller dashboard.
          </AlertDescription>
          <div className="mt-4">
            <Button asChild>
              <Link href="/product-seller/subscription">
                Subscribe Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Active products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Total orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenueFormatted}</div>
            <p className="text-xs text-muted-foreground mt-1">Total revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs">
              <div className="flex justify-between gap-3 font-medium text-emerald-900">
                <span>Credits (+)</span>
                <span className="tabular-nums">+{formatCurrency(balanceCreditsTotal)}</span>
              </div>
              <div className="flex justify-between gap-3 font-medium text-rose-900">
                <span>Charges (−)</span>
                <span className="tabular-nums">−{formatCurrency(balanceDebitsTotal)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-950">
                <span>Net</span>
                <span className="tabular-nums">{netBalanceFormatted}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link href="/product-seller/balance" className="text-primary underline-offset-2 hover:underline">
                Full ledger &amp; details
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="h-12 w-12 text-primary" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform Commission</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-600">{commissionRate ?? 0}%</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">
              {isGlobalRate ? "Platform Default Rate" : "Admin Set Custom Rate"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
