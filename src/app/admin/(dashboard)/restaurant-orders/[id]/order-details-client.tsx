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
  MapPin, Phone, Mail, Clock, Calendar, CheckSquare, Utensils, Banknote, Wallet
} from "lucide-react"
import { AdminDisburseModal } from "@/components/admin/admin-disburse-modal"

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
  subtotal?: number
  deliveryFee?: number
  commissionRate?: number
  commissionAmount?: number
  sellerNetPayout?: number
  settlementStatus?: string
  payoutDisbursedAt?: string | null
  payoutReference?: string | null
  paymentMethod?: string | null
  paymentStatus?: string
  afriTxnId?: string | null
  flotOrderId?: string | null
  paidAt?: string | null
  createdAt: string
  deliveryFullName: string
  deliveryPhone: string
  deliveryAddressLine1: string
  deliveryAddressLine2: string | null
  deliveryCity: string
  deliveryState: string
  deliveryPostalCode: string
  deliveryCountry: string
  couponCode?: string | null
  couponDiscount?: number | null
  restaurantSellerId?: string
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
    bankDetails?: any
  }
  items: OrderItem[]
}

export function AdminRestaurantOrderDetailsClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [disburseModalOpen, setDisburseModalOpen] = useState(false)

  const fetchOrder = () => {
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
  }

  useEffect(() => {
    fetchOrder()
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
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Breakdown</p>
                <div className="text-sm font-semibold space-y-1 text-slate-600 mt-1">
                  <div className="flex justify-between">
                    <span>Food Subtotal:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(order.subtotal ?? order.items.reduce((s, i) => s + i.subtotal, 0))}</span>
                  </div>
                  {order.deliveryFee && order.deliveryFee > 0 ? (
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span className="font-bold text-slate-800">+{formatCurrency(order.deliveryFee)}</span>
                    </div>
                  ) : null}
                  {order.couponDiscount && order.couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({order.couponCode}):</span>
                      <span className="font-bold">-{formatCurrency(order.couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 pt-1 border-t border-dashed border-slate-200 text-base">
                    <span>Customer Paid:</span>
                    <span className="font-black text-rose-600">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Payment Method:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-slate-800">
                        {order.paymentMethod === "FLOAT" ? "💳 Float (Card)" : order.paymentMethod === "AFRIMONEY" ? "📱 AfriMoney" : (order.paymentMethod ?? "COD")}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-bold ${order.paymentMethod === "FLOAT" ? "border-blue-300 text-blue-600 bg-blue-50" : ""}`}>
                        {order.paymentStatus ?? "PENDING"}
                      </Badge>
                    </div>
                  </div>
                  {order.afriTxnId && (
                    <div className="pt-1 text-[11px] font-semibold text-emerald-600 font-mono flex justify-between">
                      <span>AfriMoney Txn:</span>
                      <span>{order.afriTxnId}</span>
                    </div>
                  )}
                  {order.flotOrderId && (
                    <div className="pt-1 text-[11px] font-semibold text-blue-600 font-mono flex justify-between">
                      <span>Float Order ID:</span>
                      <span>{order.flotOrderId}</span>
                    </div>
                  )}
                </div>
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
                {order.seller.bankDetails && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Registered Payout Account:</p>
                    <p>Method: {order.seller.bankDetails.paymentOption || "AfriMoney / Bank"}</p>
                    {order.seller.bankDetails.bankName && <p>Bank: {order.seller.bankDetails.bankName}</p>}
                    {order.seller.bankDetails.accountHolderName && <p>Holder: {order.seller.bankDetails.accountHolderName}</p>}
                    {order.seller.bankDetails.accountNumber && <p>Acc: {order.seller.bankDetails.accountNumber}</p>}
                    {order.seller.bankDetails.mobileNumber && <p>Mobile: {order.seller.bankDetails.mobileNumber}</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Settlement & Payout Audit Card */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-background">
            <CardHeader className="bg-slate-50/50 border-b border-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" /> Platform Settlement
                </CardTitle>
                {order.settlementStatus === "PAID_OUT" ? (
                  <Badge className="bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider">
                    PAID OUT
                  </Badge>
                ) : order.settlementStatus === "YET_TO_PAY" ? (
                  <Badge className="bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider">
                    YET TO PAY
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                    ESCROW HELD
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>Food Gross Subtotal:</span>
                <span className="font-bold text-slate-900">{formatCurrency(order.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charge:</span>
                <span className="font-bold text-slate-900">{formatCurrency(order.deliveryFee ?? 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Platform Commission ({order.commissionRate ?? 10}%):</span>
                <span className="font-bold">+{formatCurrency(order.commissionAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                <span className="font-black text-slate-900">Net Restaurant Payout:</span>
                <span className="font-black text-emerald-600 text-base">{formatCurrency(order.sellerNetPayout ?? 0)}</span>
              </div>
              {order.payoutReference && (
                <div className="pt-2 text-[10px] font-mono text-emerald-600 font-bold">
                  Payout Reference: {order.payoutReference}
                  {order.payoutDisbursedAt && ` (${formatDate(order.payoutDisbursedAt)})`}
                </div>
              )}

              {order.settlementStatus === "YET_TO_PAY" && order.restaurantSellerId && (
                <div className="pt-2">
                  <Button
                    onClick={() => setDisburseModalOpen(true)}
                    className="w-full text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Banknote className="w-4 h-4" /> Mark Payout Disbursed
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Disburse Modal */}
      {disburseModalOpen && order.restaurantSellerId && (
        <AdminDisburseModal
          isOpen={disburseModalOpen}
          onClose={() => setDisburseModalOpen(false)}
          onSuccess={fetchOrder}
          sellerSector="RESTAURANT"
          sellerId={order.restaurantSellerId}
          sellerName={order.seller.restaurantName}
          suggestedAmount={order.sellerNetPayout ?? 0}
          defaultPayoutMethod={order.seller.bankDetails?.paymentOption || "AfriMoney"}
          defaultAccountSnapshot={
            order.seller.bankDetails
              ? [
                  order.seller.bankDetails.paymentOption && `Method: ${order.seller.bankDetails.paymentOption}`,
                  order.seller.bankDetails.bankName && `Bank: ${order.seller.bankDetails.bankName}`,
                  order.seller.bankDetails.accountHolderName && `Holder: ${order.seller.bankDetails.accountHolderName}`,
                  order.seller.bankDetails.accountNumber && `Acc: ${order.seller.bankDetails.accountNumber}`,
                  order.seller.bankDetails.mobileNumber && `Mobile: ${order.seller.bankDetails.mobileNumber}`,
                ]
                  .filter(Boolean)
                  .join(" • ")
              : undefined
          }
          foodOrderId={order.id}
        />
      )}
    </div>
  )
}
