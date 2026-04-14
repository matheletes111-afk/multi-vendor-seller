"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency } from "@/lib/utils"
import { Briefcase, ShoppingCart, AlertCircle, ArrowRight, TrendingUp, MousePointerClick } from "lucide-react"

type Overview = {
  subscription: { plan: { name: string } } | null
  commissionRate: number | null
  isGlobalRate: boolean
  totalServices: number
  totalOrders: number
  sellerGrossTotal: number
  sellerGrossFormatted: string
  platformCommissionTotal: number
  platformCommissionFormatted: string
  sellerNetTotal: number
  sellerNetFormatted: string
  creditList?: Array<{
    id: string
    orderId: string
    orderNumber: string
    serviceName: string
    createdAt: string
    gross: number
    grossFormatted: string
  }>
  totalAdClicks: number
}

export function ServiceSellerPageClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const res = await fetch("/api/service-seller/overview", { signal: controller.signal, cache: "no-store" })
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

  if (error) return <div className="container mx-auto p-6"><p className="text-destructive">{error}</p></div>
  if (!data) return <PageLoader message="Loading dashboard…" />

  const { subscription, totalServices, totalOrders, sellerNetFormatted, platformCommissionFormatted, commissionRate, isGlobalRate, totalAdClicks } = data

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your service seller account. Net worth below is fully credited (platform fees currently waived).
        </p>
      </div>

      {!subscription && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle>Subscription Required</AlertTitle>
          <AlertDescription className="mt-2">You need an active subscription to use the seller dashboard.</AlertDescription>
          <div className="mt-4">
            <Button asChild>
              <Link href="/service-seller/subscription">Subscribe Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Services</CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{totalServices}</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">Active services</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Orders</CardTitle>
            <div className="p-2 bg-primary/10 rounded-xl">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{totalOrders}</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">
              <Link href="/service-seller/orders" className="hover:text-primary underline-offset-4 hover:underline transition-colors">
                View order ledger →
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="h-12 w-12 text-primary" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform Commission</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-600">{commissionRate ?? 0}%</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">
              {isGlobalRate ? "Platform Default Rate" : "Admin Set Custom Rate"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <MousePointerClick className="h-12 w-12 text-primary" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ad Clicks</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <MousePointerClick className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-blue-600">{totalAdClicks}</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-2 uppercase tracking-wider opacity-60">
              Total advertisement clicks
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-background rounded-3xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">Net worth</CardTitle>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/service-seller/net-worth" className="block max-w-md space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm transition-colors hover:bg-slate-100/80">
            <div className="flex justify-between gap-4 font-medium text-emerald-900">
              <span>Gross (+)</span>
              <span className="tabular-nums">+{formatCurrency(data.sellerGrossTotal)}</span>
            </div>
            <div className="flex justify-between gap-4 font-medium text-slate-500">
              <span>Platform fees (−)</span>
              <span className="tabular-nums">−{formatCurrency(data.platformCommissionTotal)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-lg font-bold text-slate-950">
              <span>Net worth</span>
              <span className="tabular-nums">{sellerNetFormatted}</span>
            </div>
          </Link>
          <p className="text-xs leading-relaxed text-muted-foreground max-w-2xl">
            Gross is the total of your service order lines (incl. GST and line shipping). Platform fees are currently waived. Net worth = gross.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
