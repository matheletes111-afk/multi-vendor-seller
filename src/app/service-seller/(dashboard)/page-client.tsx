"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { formatCurrency } from "@/lib/utils"
import { Briefcase, ShoppingCart, AlertCircle, ArrowRight, TrendingUp } from "lucide-react"

type Overview = {
  subscription: { plan: { name: string } } | null
  totalServices: number
  totalOrders: number
  sellerGrossTotal: number
  sellerGrossFormatted: string
  platformCommissionTotal: number
  platformCommissionFormatted: string
  sellerNetTotal: number
  sellerNetFormatted: string
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

  const { subscription, totalServices, totalOrders, sellerNetFormatted, platformCommissionFormatted } = data

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your service seller account. Net worth below is gross service-line value minus platform fees (no
          product-style wallet adjustments).
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
            <p className="text-xs text-muted-foreground mt-1">Active services</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders with your services</p>
            <p className="text-xs mt-2">
              <Link href="/service-seller/orders" className="text-primary underline-offset-2 hover:underline">
                Per-order gross &amp; net
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">Net worth</CardTitle>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-md space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4 font-medium text-emerald-900">
              <span>Gross (+)</span>
              <span className="tabular-nums">+{formatCurrency(data.sellerGrossTotal)}</span>
            </div>
            <div className="flex justify-between gap-4 font-medium text-rose-900">
              <span>Platform fees (−)</span>
              <span className="tabular-nums">−{formatCurrency(data.platformCommissionTotal)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-lg font-bold text-slate-950">
              <span>Net worth</span>
              <span className="tabular-nums">{sellerNetFormatted}</span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground max-w-2xl">
            Gross is the total of your service order lines (incl. GST and line shipping). Platform fees are commission on
            those lines. Net worth = gross − fees, same basis as the orders list.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
