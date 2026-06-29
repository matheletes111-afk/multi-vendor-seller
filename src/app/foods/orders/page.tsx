"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ShoppingBag, Star, Clock, MapPin, Receipt, ChevronDown, ChevronUp, CheckCircle2, ShieldAlert } from "lucide-react"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { PublicLayout } from "@/components/site-layout"

type OrderItem = {
  id: string
  foodItemId: string
  foodName: string
  foodImage: string | null
  quantity: number
  price: number
  subtotal: number
}

type FoodOrder = {
  id: string
  orderNumber: string
  totalAmount: number
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "EXCHANGED"
  createdAt: string
  deliveryFullName: string
  deliveryPhone: string
  deliveryAddressLine1: string
  deliveryAddressLine2: string | null
  deliveryCity: string
  deliveryState: string
  deliveryPostalCode: string
  deliveryCountry: string
  restaurantName: string
  items: OrderItem[]
}

function orderStatusBadgeColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "CONFIRMED":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "PROCESSING":
    case "PREPARING":
      return "bg-indigo-50 text-indigo-700 border-indigo-200"
    case "OUT_FOR_DELIVERY":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "DELIVERED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200"
    default:
      return "bg-slate-50 text-slate-700 border-slate-200"
  }
}

export default function FoodOrdersHistoryPage() {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<FoodOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/customer/foods/orders")
      const data = await res.json()
      if (data.success) {
        // For each order, fetch detailed items
        const detailedOrders = await Promise.all(
          data.data.map(async (order: any) => {
            const detailRes = await fetch(`/api/customer/foods/orders/${order.id}`)
            const detailData = await detailRes.json()
            return detailData.success ? detailData.data : order
          })
        )
        setOrders(detailedOrders)
      }
    } catch (err) {
      console.error("Failed to load food orders:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchOrders()
    }
  }, [session])

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId))
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 text-center space-y-4 max-w-lg">
          <div className="h-12 w-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold">Retrieving your orders...</p>
        </div>
      </PublicLayout>
    )
  }

  if (orders.length === 0) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 text-center space-y-6 max-w-md animate-in fade-in duration-500">
          <ShoppingBag className="h-16 w-16 text-rose-400 mx-auto" />
          <h2 className="text-2xl font-black text-slate-800">No Food Orders Yet</h2>
          <p className="text-slate-500">Looks like you haven&apos;t ordered any gourmet meals yet. Explore our restaurant menus!</p>
          <Link href="/foods">
            <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold px-6 py-3">
              Explore Restaurants
            </Button>
          </Link>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Food Orders</h1>
          <p className="text-slate-500 font-medium text-sm">Track active deliveries and review your gourmet history.</p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id
            const orderDate = new Date(order.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })

            return (
              <Card key={order.id} className="rounded-3xl border-none shadow-md overflow-hidden bg-white hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-0">
                  {/* Collapsed view header */}
                  <div
                    onClick={() => toggleExpand(order.id)}
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-black text-slate-800">#{order.orderNumber}</span>
                        <Badge className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${orderStatusBadgeColor(order.status)}`}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                        <span>{orderDate}</span>
                        <span>•</span>
                        <span className="text-slate-700">By {order.restaurantName}</span>
                      </div>

                      <p className="text-xs text-slate-400 font-medium line-clamp-1">
                        {order.items.map(i => `${i.foodName} (x${i.quantity})`).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total amount</p>
                        <p className="text-lg font-black text-rose-600 mt-0.5">{formatCurrency(order.totalAmount)}</p>
                      </div>

                      <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30 p-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                      {/* Tracking Timeline */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Order Progress</h4>
                        <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-black tracking-wider uppercase text-slate-400">
                          {["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"].map((step, idx) => {
                            const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"]
                            const currentIdx = statuses.indexOf(order.status)
                            const isDone = currentIdx >= idx
                            const isActive = currentIdx === idx

                            return (
                              <div key={step} className="space-y-2">
                                <div className={`h-2 rounded-full mx-1 ${
                                  isDone ? "bg-rose-500" : "bg-slate-200"
                                } ${isActive ? "animate-pulse" : ""}`} />
                                <span className={`block font-bold ${
                                  isActive ? "text-rose-600" : isDone ? "text-slate-800" : "text-slate-400"
                                }`}>
                                  {step === "PROCESSING" ? "Preparing" : step.replace(/_/g, " ")}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Split Columns */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Items Ordered */}
                        <div className="md:col-span-2 space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Receipt className="h-4 w-4" /> Items Ordered
                          </h4>

                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {item.foodImage ? (
                                      <img src={item.foodImage} alt={item.foodName} className="object-cover h-full w-full" />
                                    ) : (
                                      "Food"
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{item.foodName}</p>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">{formatCurrency(item.price)} each</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-slate-900">{formatCurrency(item.subtotal)}</p>
                                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Quantity: {item.quantity}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Delivery Address & Details */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" /> Delivery Address
                          </h4>

                          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm text-xs font-semibold text-slate-600 leading-relaxed">
                            <div>
                              <p className="font-black text-slate-800 text-sm leading-none">{order.deliveryFullName}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-1">Phone: {order.deliveryPhone}</p>
                            </div>

                            <hr className="border-slate-100" />

                            <p>
                              {order.deliveryAddressLine1}
                              {order.deliveryAddressLine2 && `, ${order.deliveryAddressLine2}`}
                              <br />
                              {order.deliveryCity}, {order.deliveryState} - {order.deliveryPostalCode}
                              <br />
                              {order.deliveryCountry}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </PublicLayout>
  )
}
