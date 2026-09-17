"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Search,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Ban,
  Calendar,
  User,
  CreditCard,
  DollarSign,
  ReceiptText,
} from "lucide-react"
import type { AnalyticsOrderItem } from "@/app/api/admin/sellers/[id]/analytics/route"

interface SellerAnalyticsOrdersTabProps {
  orders: AnalyticsOrderItem[]
  sellerType: string
}

export function SellerAnalyticsOrdersTab({
  orders,
  sellerType,
}: SellerAnalyticsOrdersTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  const isHotel = sellerType === "HOTEL"
  const itemLabel = isHotel ? "Bookings" : "Orders"

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        (order.customerContact && order.customerContact.toLowerCase().includes(q)) ||
        order.itemsSummary.toLowerCase().includes(q)

      const statusUpper = order.status.toUpperCase()
      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "COMPLETED"
            ? statusUpper.includes("DELIVERED") || statusUpper.includes("COMPLETED") || statusUpper.includes("CONFIRMED")
            : statusFilter === "PENDING"
              ? statusUpper.includes("PENDING")
              : statusFilter === "PROCESSING"
                ? statusUpper.includes("PROCESSING") || statusUpper.includes("SHIPPED")
                : statusUpper.includes("CANCELLED") || statusUpper.includes("REFUNDED")

      return matchesSearch && matchesStatus
    })
  }, [orders, searchQuery, statusFilter])

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${itemLabel.toLowerCase()} by ID, customer name or items...`}
            className="pl-9 h-9 rounded-2xl text-xs"
          />
        </div>

        <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold overflow-x-auto max-w-full">
          {[
            { id: "ALL", label: "All" },
            { id: "COMPLETED", label: "Completed" },
            { id: "PROCESSING", label: "Processing" },
            { id: "PENDING", label: "Pending" },
            { id: "CANCELLED", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Card */}
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {itemLabel} History & Fulfillment Records
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {filteredOrders.length} of {orders.length} transactions recorded for this seller
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full font-semibold">
            {filteredOrders.length} Records
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="font-semibold text-sm">No {itemLabel.toLowerCase()} found</p>
              <p className="text-xs text-slate-400">No transactions match your current search or status filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                  <tr>
                    <th className="py-3.5 pl-6">{isHotel ? "Booking #" : "Order #"}</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Summary</th>
                    <th className="py-3.5 px-4">Gross Sales</th>
                    <th className="py-3.5 px-4">Commission</th>
                    <th className="py-3.5 px-4">Net Payout</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 pr-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.map((order) => {
                    const statusUpper = order.status.toUpperCase()
                    const isSuccess =
                      statusUpper.includes("DELIVERED") ||
                      statusUpper.includes("COMPLETED") ||
                      statusUpper.includes("CONFIRMED")
                    const isPending = statusUpper.includes("PENDING")
                    const isCancelled =
                      statusUpper.includes("CANCELLED") || statusUpper.includes("REFUNDED")

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Order Number */}
                        <td className="py-3.5 pl-6 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {order.orderNumber}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(order.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[140px]">
                              {order.customerName}
                            </span>
                            {order.customerContact && (
                              <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[140px]">
                                {order.customerContact}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Items Summary */}
                        <td className="py-3.5 px-4">
                          <span
                            className="text-slate-600 dark:text-slate-300 truncate block max-w-[180px]"
                            title={order.itemsSummary}
                          >
                            {order.itemsSummary}
                          </span>
                        </td>

                        {/* Gross Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrency(order.totalAmount)}
                        </td>

                        {/* Commission */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          -{formatCurrency(order.commission)}
                        </td>

                        {/* Net Amount */}
                        <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(order.netAmount)}
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium px-2 py-0.5 whitespace-nowrap"
                          >
                            {order.paymentMethod || "Online"}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 pr-6 text-right">
                          <Badge
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isSuccess
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : isPending
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                  : isCancelled
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                    : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
