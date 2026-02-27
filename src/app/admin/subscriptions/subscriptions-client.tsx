"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { formatCurrency, formatDate } from "@/lib/utils"

export function SubscriptionsClient() {
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))

  const [data, setData] = useState<{
    subscriptions: any[]
    totalCount: number
    totalPages: number
    stats: { totalCount: number; activeCount: number; totalRevenue: number; plansCount: number }
    plans: any[]
    planCountMap: Record<string, number>
    planActiveMap: Record<string, number>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/subscriptions?page=${page}&perPage=${perPage}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch subscriptions")
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
  }, [page, perPage])

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="py-12 text-center text-destructive">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const { stats, plans, planCountMap, planActiveMap, subscriptions, totalCount, totalPages } = data

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage subscription plans and seller subscriptions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Subscriptions</CardTitle>
            <CardDescription>All subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>Currently active</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>From active subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>Available plans</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.plansCount}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">Subscription Plans</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan: any) => {
            const planTotal = planCountMap[plan.id] ?? 0
            const planActive = planActiveMap[plan.id] ?? 0
            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{plan.displayName}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <Link href={`/admin/subscriptions/edit/${plan.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {formatCurrency(plan.price)}
                      {plan.price > 0 && <span className="text-lg font-normal">/month</span>}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>Products: {plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</p>
                      <p>Orders: {plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}</p>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <p className="text-sm text-muted-foreground">
                        {planActive} active subscriptions
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {planTotal} total subscriptions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>List of all seller subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller / Store</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No subscriptions yet
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription: any) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="font-medium">
                        {subscription.seller?.store?.name || subscription.seller?.user?.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {subscription.seller?.user?.email}
                      </div>
                    </TableCell>
                    <TableCell>{subscription.plan?.displayName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          subscription.status === "ACTIVE"
                            ? "default"
                            : subscription.status === "CANCELED"
                            ? "secondary"
                            : subscription.status === "PAST_DUE"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(subscription.plan?.price ?? 0)}
                      {(subscription.plan?.price ?? 0) > 0 && (
                        <span className="text-muted-foreground">/mo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {subscription.currentPeriodStart && subscription.currentPeriodEnd
                        ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(subscription.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <AdminPagination
            basePath="/admin/subscriptions"
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={perPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
