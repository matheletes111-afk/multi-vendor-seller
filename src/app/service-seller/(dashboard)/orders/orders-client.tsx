"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { ShoppingCart, Package, User, TrendingUp } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

type Order = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  commissionRate: number
  commission: number
  /** Your net for this order (gross on your lines − platform commission). */
  sellerNet: number
  createdAt: string
  customer: { name: string | null; email: string | null }
  items: Array<{
    id: string
    quantity: number
    subtotal: number
    productNameSnapshot: string | null
    serviceNameSnapshot: string | null
    product: { name: string } | null
    service: { name: string } | null
  }>
}

function itemSummary(order: Order): string {
  return order.items
    .map((item) => {
      const name =
        (item.productNameSnapshot ?? item.serviceNameSnapshot) ?? item.product?.name ?? item.service?.name ?? "Item"
      return `${name} × ${item.quantity}`
    })
    .join(", ")
}

export function ServiceOrdersClient() {
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

  const [data, setData] = useState<{
    orders: Order[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/service-seller/orders?page=${page}&perPage=${perPage}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, perPage])

  if (loading && !data) return <PageLoader variant="listing" message="Loading orders…" />

  const orders = data?.orders ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-2">View and manage your orders</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground">Orders from customers will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden md:table-cell">Customer</TableHead>
                  <TableHead className="hidden lg:table-cell">Items</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                      Your net
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Platform fee</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <Link href={`/service-seller/orders/${order.id}`} className="hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground md:hidden mt-0.5 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {order.customer.name || order.customer.email}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" />
                        {order.customer.name || order.customer.email}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[240px]">
                      <span className="flex items-start gap-1 text-sm text-muted-foreground line-clamp-2">
                        <Package className="h-3 w-3 shrink-0 mt-0.5" />
                        {itemSummary(order)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap text-muted-foreground">
                      {formatCurrency(order.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap text-emerald-800 tabular-nums">
                      {formatCurrency(order.sellerNet)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize whitespace-nowrap">
                        {order.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground whitespace-nowrap">
                      {formatCurrency(order.commission)} ({order.commissionRate}%)
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/service-seller/orders/${order.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/service-seller/orders"
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={perPage}
              params={params}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
