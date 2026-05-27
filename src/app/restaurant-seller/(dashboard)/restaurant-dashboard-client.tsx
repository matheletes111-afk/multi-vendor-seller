"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { AlertCircle, ArrowRight, TrendingUp } from "lucide-react"

type Overview = {
  subscription: any | null
  commissionRate: number | null
  isGlobalRate: boolean
  estimateRestaurantCount: number
}

export function RestaurantDashboardClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const res = await fetch("/api/restaurant-seller/overview", { signal: controller.signal, cache: "no-store" })
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

  const { subscription, commissionRate, isGlobalRate, estimateRestaurantCount } = data

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 font-sans">Dashboard</h1>
        <p className="text-slate-500 mt-2 font-medium">
          Overview of your restaurant partner panel.
        </p>
      </div>

      {!subscription && (
        <Alert className="border-red-200 bg-red-50/50 rounded-3xl p-6">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900 font-bold ml-2">Subscription Required</AlertTitle>
          <AlertDescription className="mt-2 text-red-700 font-medium ml-2">
            You need an active subscription to manage restaurant outlets and accept orders.
          </AlertDescription>
          <div className="mt-4 ml-2">
            <Button asChild className="rounded-2xl bg-red-600 hover:bg-red-700 font-bold text-xs uppercase tracking-widest px-6">
              <Link href="/restaurant-seller/subscription">
                Subscribe Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Alert>
      )}


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Outlets</CardTitle>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
              🍳
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">0</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
              Out of {estimateRestaurantCount} Estimated
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Orders</CardTitle>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              📦
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">0</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
              Received in current period
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Platform Commission</CardTitle>
            <div className="p-2.5 bg-amber-50 rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-600">{commissionRate ?? 0}%</div>
            <p className="text-[10px] font-medium text-slate-400 mt-2 uppercase tracking-wider opacity-80">
              {isGlobalRate ? "Platform Default Rate" : "Admin Set Custom Rate"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Avg Rating</CardTitle>
            <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-2xl group-hover:scale-110 transition-transform">
              ⭐
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">N/A</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
              No feedback collected yet
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] text-center">
        <h2 className="text-2xl font-bold text-emerald-900">Partner Dashboard Active!</h2>
        <p className="text-emerald-700 mt-2 max-w-lg mx-auto font-medium">
          Welcome to the new restaurant seller dashboard. Configure your menus and track customer orders easily.
        </p>
      </div>
    </div>
  )
}
