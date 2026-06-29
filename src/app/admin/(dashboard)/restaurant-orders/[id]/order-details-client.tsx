"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { 
  ShoppingBag, User, Store, ArrowLeft, 
  MapPin, Phone, Mail, Clock, Calendar, CheckSquare, Utensils
} from "lucide-react"

type OrderItem = {
  id: string
  foodItemId: string
  foodName: string
  category: string
  isVeg: boolean
  quantity: number
  price: number
  subtotal: number
  imageUrl: string | null
}

type OrderDetails = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  deliveryFullName: string
  deliveryPhone: string
  deliveryAddressLine1: string
  deliveryAddressLine2: string | null
  deliveryCity: string
  deliveryState: string
  deliveryPostalCode: string
  deliveryCountry: string
  customer: {
    name: string
    email: string
    phone: string
  }
  seller: {
    restaurantName: string
    ownerName: string
    email: string
    phone: string
    address: string
  }
  items: OrderItem[]
}

export function AdminRestaurantOrderDetailsClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    fetch(`/api/admin/restaurant-orders/${orderId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json?.data) {
          setOrder(json.data)
        } else {
          setErrorMsg(json?.error || "Failed to load order details.")
        }
      })
      .catch(() => setErrorMsg("Failed to connect to server."))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <PageLoader message="Loading order details..." />

  if (errorMsg || !order) {
    return (
      <div className="container mx-auto p-6 max-w-lg text-center space-y-6">
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-rose-500">
          <Utensils className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Order Not Found</h2>
        <p className="text-slate-500">{errorMsg || "The requested restaurant food order details could not be retrieved."}</p>
        <Button onClick={() => router.push("/admin/restaurant-orders")} className="rounded-xl bg-slate-900 text-white font-bold px-6">
          Back to Restaurant Orders
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500 max-w-6xl">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/admin/restaurant-orders">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Order Details</h1>
          <p className="text-muted-foreground">Detailed audit of food order #{order.orderNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Order items and summary */}
        <div className="lg:col-span-2 space-y-8">
          {/* Order Status & Progress */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-background">
            <CardHeader className="bg-slate-50/50 border-b border-muted/20 pb-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-600" /> Order Status
                </CardTitle>
                <Badge className={`capitalize font-bold text-xs px-4 py-1.5 rounded-full border-none shadow-sm ${
                  order.status === "DELIVERED" ? "bg-emerald-500 text-white" :
                  order.status === "CANCELLED" ? "bg-rose-600 text-white" :
                  order.status === "PROCESSING" ? "bg-blue-500 text-white" :
                  "bg-slate-200 text-slate-700"
                }`}>
                  {order.status.toLowerCase().replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placed On</p>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{formatDate(order.createdAt)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placed At</p>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                <p className="text-2xl font-black text-rose-600 leading-none mt-1">{formatCurrency(order.totalAmount)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Ordered Food Items */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-background overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-muted/20 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" /> Ordered Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex gap-4 items-center">
                      <div className="h-20 w-20 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.foodName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Utensils className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-800 text-base">{item.foodName}</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="rounded-lg font-bold text-[10px] bg-slate-100 text-slate-600 border px-2 py-0.5">
                            {item.category}
                          </Badge>
                          <Badge className={`rounded-lg px-2 py-0.5 font-bold text-[10px] ${item.isVeg ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            {item.isVeg ? "Veg" : "Non-Veg"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 font-bold tabular-nums">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-2 shrink-0 border-t border-dashed border-slate-100 pt-3 sm:pt-0 sm:border-0">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider sm:hidden">Subtotal</span>
                      <span className="font-black text-slate-900 text-lg tabular-nums">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Customer and Seller Details cards */}
        <div className="space-y-8">
          {/* Customer Card */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-background">
            <CardHeader className="bg-slate-50/50 border-b border-muted/20 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" /> Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">{order.customer.name}</h4>
              </div>
              <div className="space-y-2 text-xs font-bold text-slate-500">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-mono">{order.customer.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{order.customer.phone}</span>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Delivery Destination
                </p>
                <div className="text-xs font-bold text-slate-700 space-y-1 pl-4 border-l border-slate-100">
                  <p>{order.deliveryFullName}</p>
                  <p className="text-slate-500 font-semibold leading-relaxed">
                    {order.deliveryAddressLine1}
                    {order.deliveryAddressLine2 && `, ${order.deliveryAddressLine2}`}
                    <br />
                    {order.deliveryCity}, {order.deliveryState} - {order.deliveryPostalCode}
                    <br />
                    {order.deliveryCountry}
                  </p>
                  <p className="text-slate-400">Phone: {order.deliveryPhone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Seller Card */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-background">
            <CardHeader className="bg-slate-50/50 border-b border-muted/20 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" /> Restaurant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">{order.seller.restaurantName}</h4>
                <p className="text-[11px] text-slate-400 font-bold">Owner: {order.seller.ownerName}</p>
              </div>
              <div className="space-y-2 text-xs font-bold text-slate-500">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-mono">{order.seller.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{order.seller.phone}</span>
                </div>
                {order.seller.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed text-slate-500">{order.seller.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
