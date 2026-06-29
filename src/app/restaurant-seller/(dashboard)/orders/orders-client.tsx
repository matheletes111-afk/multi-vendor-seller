"use client"

import { useState, useEffect } from "react"
import { ShoppingBag, Search, ChevronDown, ChevronUp, MapPin, Phone, User, Check, Trash, Loader2, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"

type OrderItem = {
  id: string
  foodName: string
  foodImage: string | null
  quantity: number
  price: number
  subtotal: number
}

type Order = {
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
  customerName: string
  customerEmail: string
  items: OrderItem[]
}

const statusWorkflow = [
  { status: "PENDING", label: "Pending Approval" },
  { status: "CONFIRMED", label: "Confirm Order" },
  { status: "PROCESSING", label: "Start Preparing" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Deliver Order" }
]

function orderStatusBadgeColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "CONFIRMED":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "PROCESSING":
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

export function RestaurantOrdersClient() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("ALL")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/restaurant-seller/orders")
      const data = await res.json()
      if (data.success) {
        setOrders(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/restaurant-seller/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      })
      const data = await res.json()
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus as any } : o))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedOrderId(prev => (prev === id ? null : id))
  }

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.deliveryFullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = selectedStatus === "ALL" || o.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Order Desk</h1>
          <p className="text-slate-500 font-medium text-sm">Manage incoming and past food orders.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {["ALL", "PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                selectedStatus === status
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {status === "ALL" ? "All Orders" : status.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="relative">
        <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
        <input
          placeholder="Search by order #, customer name, delivery name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 w-full h-11 border border-slate-200 rounded-2xl shadow-sm text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto" />
          <p className="text-slate-500 font-medium mt-3 text-sm">Loading order feed...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="rounded-[2rem] border-none shadow-sm text-center py-16">
          <CardContent className="space-y-4">
            <ShoppingBag className="h-16 w-16 text-slate-300 mx-auto" />
            <h3 className="text-lg font-black text-slate-800">No Orders Found</h3>
            <p className="text-slate-500 text-xs mt-1">Try expanding your search query or filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const isExpanded = expandedOrderId === order.id
            const orderDate = new Date(order.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short"
            })

            // Next available action in workflow
            const workflowIndex = statusWorkflow.findIndex(w => w.status === order.status)
            const nextAction = workflowIndex !== -1 && workflowIndex < statusWorkflow.length - 1
              ? statusWorkflow[workflowIndex + 1]
              : null

            return (
              <Card key={order.id} className="rounded-3xl border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div
                    onClick={() => toggleExpand(order.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
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
                        <span>Customer: {order.customerName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{formatCurrency(order.totalAmount)}</p>
                      </div>

                      <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                        {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/20 p-6 space-y-6">
                      {/* Workflow Actions */}
                      {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Cycle Action</span>
                            <p className="text-xs font-bold text-slate-700">Update status to proceed the delivery timeline.</p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                              disabled={updatingId === order.id}
                              variant="outline"
                              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs uppercase tracking-wider"
                            >
                              Cancel Order
                            </Button>

                            {nextAction && (
                              <Button
                                onClick={() => handleUpdateStatus(order.id, nextAction.status)}
                                disabled={updatingId === order.id}
                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
                              >
                                {updatingId === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    {nextAction.label} <ArrowRight className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Items & Address details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Dishes ordered</h4>
                          <div className="space-y-2">
                            {order.items.map(item => (
                              <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-sm text-sm">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {item.foodImage ? (
                                      <img src={item.foodImage} alt={item.foodName} className="object-cover h-full w-full" />
                                    ) : (
                                      "Food"
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">{item.foodName}</p>
                                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">{formatCurrency(item.price)} each</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-black text-slate-900">{formatCurrency(item.subtotal)}</p>
                                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Quantity: {item.quantity}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Delivery instructions</h4>
                          <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3 shadow-sm text-xs font-semibold text-slate-600">
                            <div>
                              <p className="font-black text-slate-800 text-sm leading-none">{order.deliveryFullName}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {order.deliveryPhone}
                              </p>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="flex gap-1.5 items-start">
                              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                              <p className="leading-relaxed">
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
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
}
