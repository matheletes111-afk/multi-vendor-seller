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

type Overview = {
  totalSellers: number
  totalCustomers: number
  totalProducts: number
  totalServices: number
  totalOrders: number
  totalRevenue: number
  pendingSellers: number
}

export function AdminDashboardClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch overview")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading && !data) return <PageLoader message="Loading dashboard…" />
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="py-12 text-center text-destructive">{error}</div>
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
    pendingSellers,
  } = data

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your marketplace platform
        </p>
      </div>

      {pendingSellers > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Pending Approvals</CardTitle>
            </div>
            <CardDescription>
              {pendingSellers} seller{pendingSellers !== 1 ? "s" : ""} waiting for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/sellers">
              <Badge variant="destructive" className="cursor-pointer hover:bg-destructive/90">
                Review Now
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sellers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSellers}</div>
            <p className="text-xs text-muted-foreground mt-1">Total registered sellers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">Total customers</p>
          </CardContent>
        </Card>

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
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
            <p className="text-xs text-muted-foreground mt-1">Active services</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Total Orders
            </CardTitle>
            <CardDescription>All time orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Platform Revenue
            </CardTitle>
            <CardDescription>Total commissions earned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/sellers">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Sellers
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  Approve, suspend, or manage sellers
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/subscriptions">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Subscriptions
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  View and manage seller subscriptions
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/admin/categories">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Categories
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  Create and manage categories
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
