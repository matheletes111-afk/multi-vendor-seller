"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import type { AdminOrderListItemApi } from "@/app/api/admin/orders/types"
import { ShoppingCart, User, Store } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"

export function AdminOrdersClient() {
  const searchParams = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "10", 10) || 10))
  const params = {
    error: searchParams.get("error") ?? undefined,
    success: searchParams.get("success") ?? undefined,
  }

  const [data, setData] = useState<{
    orders: AdminOrderListItemApi[]
    totalCount: number
    totalPages: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/orders?page=${page}&perPage=${perPage}`, { credentials: "include" })
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
        <p className="text-muted-foreground mt-2">All orders across sellers</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground">Orders will appear here when customers place orders</p>
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
                  <TableHead className="hidden lg:table-cell">Store</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Commission</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {order.customerName || order.customerEmail || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" />
                        {order.customerName || order.customerEmail || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3 shrink-0" />
                        {order.sellerStoreName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize whitespace-nowrap">
                        {order.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground whitespace-nowrap">
                      -{formatCurrency(order.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/orders/${order.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/admin/orders"
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
