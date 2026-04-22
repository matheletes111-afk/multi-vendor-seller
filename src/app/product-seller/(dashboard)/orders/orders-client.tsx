"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { ShoppingCart, Package, User } from "lucide-react"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Search, RotateCcw, Calendar } from "lucide-react"

type Order = {
  id: string
  orderNumber: string
  status: string
  hasReturnFlag?: boolean
  totalAmount: number
  commissionRate: number
  commission: number
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

export function OrdersClient() {
  const router = useRouter()
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

  const [filters, setFilters] = useState({
    orderNumber: "",
    customerName: "",
    email: "",
    productName: "",
    startDate: "",
    endDate: "",
    status: "ALL",
  })
  const [activeFilters, setActiveFilters] = useState(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const queryParams = new URLSearchParams({
      page: page.toString(),
      perPage: perPage.toString(),
      ...(activeFilters.orderNumber && { orderNumber: activeFilters.orderNumber }),
      ...(activeFilters.customerName && { customerName: activeFilters.customerName }),
      ...(activeFilters.email && { email: activeFilters.email }),
      ...(activeFilters.productName && { productName: activeFilters.productName }),
      ...(activeFilters.startDate && { startDate: activeFilters.startDate }),
      ...(activeFilters.endDate && { endDate: activeFilters.endDate }),
      ...(activeFilters.status !== "ALL" && { status: activeFilters.status }),
    })

    fetch(`/api/product-seller/orders?${queryParams.toString()}`)
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
  }, [page, perPage, activeFilters])

  const handleSearch = () => {
    setActiveFilters(filters)
    router.push("/product-seller/orders?page=1")
  }

  const handleReset = () => {
    const reset = {
      orderNumber: "",
      customerName: "",
      email: "",
      productName: "",
      startDate: "",
      endDate: "",
      status: "ALL",
    }
    setFilters(reset)
    setActiveFilters(reset)
    router.push("/product-seller/orders?page=1")
  }

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

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="orderNumber">Order Number</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="orderNumber"
                placeholder="e.g. 0001"
                className="pl-8"
                value={filters.orderNumber}
                onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              placeholder="Search by name"
              value={filters.customerName}
              onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Customer Email</Label>
            <Input
              id="email"
              placeholder="Search by email"
              value={filters.email}
              onChange={(e) => setFilters({ ...filters, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productName">Product Name</Label>
            <Input
              id="productName"
              placeholder="Search by product"
              value={filters.productName}
              onChange={(e) => setFilters({ ...filters, productName: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="startDate"
                type="date"
                className="pl-8"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="endDate"
                type="date"
                className="pl-8"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(val) => setFilters({ ...filters, status: val })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="EXCHANGED">Exchanged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset} title="Reset Filters">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

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
                      <Link href={`/product-seller/orders/${order.id}`} className="hover:underline">
                        #{order.orderNumber}
                      </Link>
                      {order.hasReturnFlag ? (
                        <Badge variant="destructive" className="ml-2 text-[10px] uppercase tracking-wide">
                          Return
                        </Badge>
                      ) : null}
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
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize whitespace-nowrap">
                        {order.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground whitespace-nowrap">
                      -{formatCurrency(order.commission)} ({order.commissionRate}%)
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/product-seller/orders/${order.id}`}>View</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="border-primary/20 hover:bg-primary/5 text-primary">
                          <Link href={`/product-seller/orders/${order.id}/invoice`} target="_blank">
                            Invoice
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-6">
            <AdminPagination
              basePath="/product-seller/orders"
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
