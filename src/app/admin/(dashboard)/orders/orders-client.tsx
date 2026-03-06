"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import type { AdminOrderListItemApi } from "@/app/api/admin/orders/types"
import { ShoppingCart, User, Store } from "lucide-react"

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<AdminOrderListItemApi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/orders", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader variant="listing" message="Loading orders…" />

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
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:underline focus:underline"
                      >
                        Order #{order.orderNumber}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {order.customerName || order.customerEmail || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {order.sellerStoreName ?? "—"}
                      </span>
                      <span>{formatDate(order.createdAt)}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatCurrency(order.totalAmount)}</p>
                    <Badge variant="outline" className="mt-1 capitalize">
                      {order.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{order.itemCount} item(s)</span>
                  <span>Commission: -{formatCurrency(order.commission)}</span>
                </div>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href={`/admin/orders/${order.id}`}>View details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
