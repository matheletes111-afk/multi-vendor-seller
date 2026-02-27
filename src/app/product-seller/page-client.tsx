"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { Package, ShoppingCart, DollarSign, AlertCircle, ArrowRight } from "lucide-react"

type Overview = {
  subscription: { plan: { name: string } } | null
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  totalRevenueFormatted: string
}

export function ProductSellerPageClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/product-seller/overview")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load")
        return r.json()
      })
      .then(setData)
      .catch(() => setError("Failed to load dashboard"))
  }, [])

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }
  if (!data) return <PageLoader message="Loading dashboard…" />

  const { subscription, totalProducts, totalOrders, totalRevenueFormatted } = data

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
      </div>
    </div>
  )
}
