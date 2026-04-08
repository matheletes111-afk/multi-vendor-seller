"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import Link from "next/link"
import {
  Users,
  ShoppingBag,
  Package,
  Briefcase,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/ui/button"

type Overview = {
  totalSellers: number
  totalCustomers: number
  totalProducts: number
  totalServices: number
  totalOrders: number
  totalRevenue: number
  subscriptionRevenue: number
  adRevenue: number
  commissionRevenue: number
  pendingSellers: number
}

export function AdminDashboardClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const res = await fetch("/api/admin/overview", { signal: controller.signal, cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch overview")
        const json = (await res.json()) as Overview
        setData(json)
        setError(null)
      } catch (e: any) {
        if (e?.name === "AbortError") return
        setError(e?.message || "Failed to fetch overview")
      } finally {
        setLoading(false)
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

  if (loading && !data) return <PageLoader message="Loading dashboard…" />
  if (error) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="p-3 bg-destructive/10 inline-block rounded-full">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <p className="text-destructive font-medium text-lg">{error}</p>
        </div>
      </div>
    )
  }
  if (!data) return null

  const {
    totalSellers,
    totalCustomers,
    totalProducts,
    totalServices,
    totalOrders,
    totalRevenue,
    subscriptionRevenue,
    adRevenue,
    commissionRevenue,
    pendingSellers,
  } = data

  return (
    <div className="container mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Admin Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Real-time marketplace monitoring & management</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium rounded-full shadow-sm bg-background border-primary/20 text-primary">
            Live Updates Enabled
          </Badge>
        </div>
      </div>

      {pendingSellers > 0 && (
        <Card className="border-none shadow-xl bg-gradient-to-r from-red-500/10 via-destructive/5 to-transparent relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <AlertCircle className="h-20 w-20 text-destructive rotate-12" />
          </div>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-xl shadow-inner">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <CardTitle className="text-xl font-medium text-destructive">Attention Required</CardTitle>
            </div>
            <CardDescription className="text-sm font-medium text-muted-foreground/80 mt-1">
              You have {pendingSellers} seller{pendingSellers !== 1 ? "s" : ""} waiting for approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/sellers">
              <Button variant="destructive" className="rounded-full px-5 font-medium text-xs hover:scale-105 transition-all shadow-lg shadow-destructive/20">
                Review Applications <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sellers", value: totalSellers, icon: Users, color: "blue", desc: "Registered accounts" },
          { label: "Customers", value: totalCustomers, icon: ShoppingBag, color: "green", desc: "Platform users" },
          { label: "Products", value: totalProducts, icon: Package, color: "orange", desc: "Active listings" },
          { label: "Services", value: totalServices, icon: Briefcase, color: "purple", desc: "Available services" },
        ].map((stat) => (
          <Card key={stat.label} className="border-none shadow-lg bg-background hover:shadow-xl transition-all duration-300 group overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground/80 lowercase tracking-widest">{stat.label}</CardTitle>
              <div className={`p-1.5 bg-${stat.color}-500/10 rounded-lg group-hover:scale-110 transition-transform`}>
                <stat.icon className={`h-4 w-4 text-${stat.color}-500`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-medium text-foreground">{stat.value.toLocaleString()}</div>
              <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-500/5 to-transparent relative overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-indigo-500" />
                  Total Orders
                </CardTitle>
                <CardDescription className="text-xs font-medium">Accumulated platform transaction volume</CardDescription>
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-2xl group-hover:rotate-6 transition-transform">
                <ShoppingCart className="h-6 w-6 text-indigo-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-medium text-indigo-600 dark:text-indigo-400">{totalOrders.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  Subscription Revenue
                </CardTitle>
                <CardDescription className="text-xs font-medium">Income from seller plans</CardDescription>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-2xl group-hover:rotate-6 transition-transform">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-medium text-blue-600 dark:text-blue-400">{formatCurrency(subscriptionRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-orange-500/5 to-transparent relative overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  Ad Revenue
                </CardTitle>
                <CardDescription className="text-xs font-medium">Income from direct ad promotions</CardDescription>
              </div>
              <div className="p-2 bg-orange-500/10 rounded-2xl group-hover:rotate-6 transition-transform">
                <DollarSign className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-medium text-orange-600 dark:text-orange-400">{formatCurrency(adRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  Total Platform Revenue
                </CardTitle>
                <CardDescription className="text-xs font-medium">Combined subscription and ad revenue</CardDescription>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-2xl group-hover:rotate-6 transition-transform">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-6 flex items-center gap-2 text-foreground/80">
          <ArrowRight className="h-5 w-5 text-primary" />
          Quick Actions
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { href: "/admin/sellers", title: "Manage Sellers", desc: "Review and moderate seller accounts", icon: Users },
            { href: "/admin/subscriptions", title: "Subscription Controls", desc: "Manage billing plans and revenue", icon: DollarSign },
            { href: "/admin/categories", title: "Catalog Hierarchy", desc: "Organize product & service categories", icon: Package },
          ].map((action) => (
            <Link href={action.href} key={action.title}>
              <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-none bg-muted/40 group h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between font-medium text-base group-hover:text-primary transition-colors">
                    {action.title}
                    <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <action.icon className="h-4 w-4" />
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs font-medium group-hover:text-foreground/80 transition-colors">
                    {action.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
