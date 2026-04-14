"use client"

import { useCallback, useEffect, useMemo, useState, Fragment } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import type { SellerOrderDetailApi } from "@/app/api/product-seller/orders/types"
import { SELLER_ORDER_STATUSES } from "@/app/api/product-seller/orders/types"
import {
  Package,
  MapPin,
  User,
  ArrowLeft,
  Loader2,
  Receipt,
  Banknote,
  ShoppingBag,
  History,
  Upload,
  Truck,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  AlertCircle,
  X,
  ArrowLeftRight,
  Wallet,
  ShieldCheck,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { getExchangeOrderPriceBreakdown } from "@/lib/exchange-order-display"
import { exchangeTopUpCodLabel } from "@/lib/exchange-top-up-display"
import { flattenOrderItemsForDisplay } from "@/lib/customer-order-item-order"
import {
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const TIMELINE_PREVIEW = 5

type ReturnAction = "ACCEPT" | "REJECT" | "PICKUP_COMPLETED" | "REFUND_COMPLETED" | "EXCHANGE_TOP_UP_RECEIVED"

function computeLastUpdatedAt(order: SellerOrderDetailApi): Date {
  let max = new Date(order.createdAt).getTime()
  for (const item of order.items) {
    for (const h of item.statusHistory) {
      const t = new Date(h.createdAt).getTime()
      if (t > max) max = t
    }
  }
  return new Date(max)
}

function itemStatusBadgeClass(status: string): string {
  const s = status.toUpperCase().replace(/\s/g, "_")
  switch (s) {
    case "PENDING":
      return "bg-slate-100 text-slate-800 border-slate-200"
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200"
    case "PROCESSING":
      return "bg-amber-50 text-amber-900 border-amber-200"
    case "SHIPPED":
      return "bg-blue-50 text-blue-800 border-blue-200"
    case "OUT_FOR_DELIVERY":
      return "bg-violet-50 text-violet-800 border-violet-200"
    case "DELIVERED":
      return "bg-emerald-50 text-emerald-900 border-emerald-200"
    case "CANCELLED":
    case "REFUNDED":
      return "bg-red-50 text-red-800 border-red-200"
    default:
      return "bg-slate-50 text-slate-800 border-slate-200"
  }
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toUpperCase()
  if (s === "CANCELLED" || s === "REFUNDED") return "bg-red-50 text-red-800 border-red-200"
  if (s === "DELIVERED" || s === "COMPLETED") return "bg-emerald-50 text-emerald-900 border-emerald-200"
  if (s === "SHIPPED") return "bg-blue-50 text-blue-800 border-blue-200"
  return "bg-slate-50 text-slate-800 border-slate-200"
}

function returnRequestBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "NONE").toUpperCase()
  if (s === "ACCEPTED") return "bg-red-50 text-red-800 border-red-200"
  if (s === "REJECTED") return "bg-slate-100 text-slate-700 border-slate-300"
  if (s === "REQUESTED") return "bg-amber-50 text-amber-900 border-amber-200"
  return "bg-slate-50 text-slate-600 border-slate-200"
}

function pickupBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "NOT_REQUESTED").toUpperCase()
  if (s === "COMPLETED") return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (s === "PENDING") return "bg-amber-50 text-amber-900 border-amber-200"
  return "bg-slate-50 text-slate-600 border-slate-200"
}

function refundBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "NOT_REQUESTED").toUpperCase()
  if (s === "COMPLETED") return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (s === "PENDING") return "bg-amber-50 text-amber-900 border-amber-200"
  return "bg-slate-50 text-slate-600 border-slate-200"
}

function TimelineDot({ isLatest }: { isLatest: boolean }) {
  return (
    <span
      className={cn(
        "absolute -left-[calc(0.5rem+5px)] top-1.5 flex h-3 w-3 rounded-full ring-4 ring-white",
        isLatest ? "bg-emerald-500" : "bg-slate-400"
      )}
      aria-hidden
    />
  )
}

function timelineIconForStatus(status: string) {
  const s = status.toUpperCase().replace(/\s/g, "_")
  if (s.includes("DELIVERED")) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
  if (s.includes("SHIP")) return <Truck className="h-4 w-4 text-blue-600" aria-hidden />
  if (s.includes("PROCESS")) return <RefreshCw className="h-4 w-4 text-amber-600" aria-hidden />
  if (s.includes("CONFIRM")) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
  if (s.includes("PENDING")) return <Clock className="h-4 w-4 text-slate-500" aria-hidden />
  return <Circle className="h-4 w-4 text-slate-400" aria-hidden />
}

export function ProductSellerOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<SellerOrderDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [itemStatusDrafts, setItemStatusDrafts] = useState<Record<string, string>>({})
  const [deliveryProofDrafts, setDeliveryProofDrafts] = useState<Record<string, string>>({})
  const [deliveryProofFiles, setDeliveryProofFiles] = useState<Record<string, File | null>>({})
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [otpDrafts, setOtpDrafts] = useState<Record<string, string>>({})
  const [updateLoading, setUpdateLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [returnActionLoadingItemId, setReturnActionLoadingItemId] = useState<string | null>(null)
  const [deliveryProofUploadingItemId, setDeliveryProofUploadingItemId] = useState<string | null>(null)
  const [timelineExpanded, setTimelineExpanded] = useState<Record<string, boolean>>({})
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [confirmReturn, setConfirmReturn] = useState<{
    itemId: string
    action: ReturnAction
    title: string
    description: string
  } | null>(null)

  const uploadDeliveryProofOnSave = async (itemId: string): Promise<string> => {
    const file = deliveryProofFiles[itemId]
    if (!file) throw new Error("Choose a delivery proof image first")
    setDeliveryProofUploadingItemId(itemId)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("purpose", "delivery-proof")
    const res = await fetch("/api/product-seller/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) throw new Error(data.error ?? "Upload failed")
    if (!data.url) throw new Error("No URL returned from upload")
    setDeliveryProofDrafts((prev) => ({ ...prev, [itemId]: data.url! }))
    return data.url
  }

  const fetchOrder = useCallback(() => {
    return fetch(`/api/product-seller/orders/${orderId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        if (!res.ok) return null
        return res.json()
      })
      .then((data: SellerOrderDetailApi | null) => {
        if (data) {
          setOrder(data)
          setItemStatusDrafts(
            data.items.reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = item.itemStatus
              return acc
            }, {})
          )
          setDeliveryProofDrafts(
            data.items.reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = item.deliveryProofImage ?? ""
              return acc
            }, {})
          )
          setDeliveryProofFiles(
            data.items.reduce<Record<string, File | null>>((acc, item) => {
              acc[item.id] = null
              return acc
            }, {})
          )
          setLocationDrafts(
            data.items.reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = item.statusHistory[item.statusHistory.length - 1]?.location ?? ""
              return acc
            }, {})
          )
          setNoteDrafts(
            data.items.reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = ""
              return acc
            }, {})
          )
          setOtpDrafts(
            data.items.reduce<Record<string, string>>((acc, item) => {
              acc[item.id] = ""
              return acc
            }, {})
          )
        }
      })
  }, [orderId])

  useEffect(() => {
    setLoading(true)
    fetchOrder().finally(() => setLoading(false))
  }, [fetchOrder])

  useEffect(() => {
    if (!successMessage) return
    const t = window.setTimeout(() => setSuccessMessage(null), 5000)
    return () => window.clearTimeout(t)
  }, [successMessage])

  const canUpdateStatus =
    order && order.status !== "CANCELLED" && order.status !== "REFUNDED"

  const priceBreakdown = useMemo(
    () => (order ? getExchangeOrderPriceBreakdown(order) : ({ kind: "standard" } as const)),
    [order],
  )

  const assignProofFile = (itemId: string, file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_PROOF_BYTES) {
      setStatusError("Image must be 5MB or smaller.")
      return
    }
    if (!file.type.startsWith("image/")) {
      setStatusError("Please upload an image file (e.g. JPG or PNG).")
      return
    }
    setStatusError(null)
    setDeliveryProofFiles((prev) => ({ ...prev, [itemId]: file }))
    setDeliveryProofDrafts((prev) => ({ ...prev, [itemId]: "" }))
  }

  const handleUpdateItemStatus = async (itemId: string) => {
    if (!order || !canUpdateStatus) return
    const current = order.items.find((item) => item.id === itemId)?.itemStatus
    const next = itemStatusDrafts[itemId]
    if (!next || !current || next === current) return
    if (current === "DELIVERED") {
      setStatusError(ORDER_ITEM_LOCKED_AFTER_DELIVERED)
      return
    }
    if (next === "CANCELLED" && current !== "PENDING") {
      setStatusError("Can only cancel items that are PENDING")
      return
    }
    if (next === "CANCELLED" && order.orderHasDeliveredLine) {
      setStatusError(ORDER_CANCEL_BLOCKED_DELIVERED)
      return
    }
    setStatusError(null)
    setUpdateLoading(true)
    try {
      let deliveryProofImage = (deliveryProofDrafts[itemId] || "").trim()
      if (next === "DELIVERED" && !deliveryProofImage) {
        deliveryProofImage = await uploadDeliveryProofOnSave(itemId)
      }
      if (next === "DELIVERED" && !deliveryProofImage) {
        throw new Error("Delivery proof image is required for delivered status")
      }
      const res = await fetch(`/api/product-seller/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: next,
          itemId,
          deliveryProofImage: next === "DELIVERED" ? deliveryProofImage : undefined,
          location: (locationDrafts[itemId] || "").trim() || undefined,
          note: (noteDrafts[itemId] || "").trim() || undefined,
          otp: (otpDrafts[itemId] || "").trim() || undefined,
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? "Failed")
      }
      await fetchOrder()
      setDeliveryProofFiles((prev) => ({ ...prev, [itemId]: null }))
      setSuccessMessage("Shipment status updated successfully.")
      setTimelineExpanded((prev) => ({ ...prev, [itemId]: false }))
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed")
    } finally {
      setUpdateLoading(false)
      setDeliveryProofUploadingItemId(null)
    }
  }

  const handleReturnAction = (itemId: string, action: ReturnAction) => {
    setStatusError(null)
    setReturnActionLoadingItemId(itemId)
    fetch(`/api/product-seller/orders/${orderId}/items/${itemId}/return-request`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d: { error?: string }) => { throw new Error(d.error ?? "Failed") })
        return fetchOrder()
      })
      .then(() => setSuccessMessage("Return action completed."))
      .catch((err: Error) => setStatusError(err.message))
      .finally(() => {
        setReturnActionLoadingItemId(null)
        setConfirmReturn(null)
      })
  }

  const lastUpdated = useMemo(() => (order ? computeLastUpdatedAt(order) : null), [order])

  const orderedItems = useMemo(
    () => (order ? flattenOrderItemsForDisplay(order.items) : []),
    [order],
  )

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl p-4 sm:p-6">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-amber-500" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading order details…</p>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="container mx-auto max-w-6xl p-4 sm:p-6">
        <Card className="border-slate-200 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">Order not found.</p>
            <Button asChild variant="outline">
              <Link href="/product-seller/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const itemName = (item: SellerOrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"

  const lineTotal = (item: SellerOrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Alerts */}
      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {statusError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      )}

      {/* Page header redesign */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" className="-ml-2 h-9 gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all" asChild>
            <Link href="/product-seller/orders">
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Order Fulfillment
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="font-medium text-sm bg-muted px-2 py-0.5 rounded-md text-muted-foreground border border-muted-foreground/10">
                ORD#{order.orderNumber}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                {lastUpdated ? `Updated ${lastUpdated.toLocaleString()}` : formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 items-start md:items-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 px-1">Global Status</span>
            <Badge className={cn("border-none px-4 py-1.5 rounded-full text-xs font-bold shadow-sm uppercase tracking-wide", orderStatusBadgeClass(order.status))}>
              {order.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 px-1">Payment</span>
            <Badge variant="outline" className="text-xs font-bold uppercase tracking-tight py-1 rounded-lg shadow-inner bg-background/50 backdrop-blur-sm">
              {order.paymentStatus}
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* Left column ~60% */}
        <div className="space-y-6 lg:col-span-3">
          {orderedItems.map((item) => {
            const draftStatus = itemStatusDrafts[item.id] ?? item.itemStatus
            const showShipmentForm =
              canUpdateStatus &&
              item.itemStatus !== "REFUNDED" &&
              item.itemStatus !== "EXCHANGED" &&
              item.itemStatus !== "DELIVERED"
            const hist = item.statusHistory
            const expanded = timelineExpanded[item.id] ?? false
            const timelineShown = expanded ? hist : hist.slice(-TIMELINE_PREVIEW)
            const timelineOffset = expanded ? 0 : Math.max(0, hist.length - timelineShown.length)
            const hasMore = hist.length > TIMELINE_PREVIEW

            return (
              <Fragment key={item.id}>
                {/* A. Product information redesign */}
                <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-background to-muted/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader className="border-b bg-muted/20 py-6">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2.5 bg-amber-500/10 rounded-2xl">
                        <ShoppingBag className="h-6 w-6 text-amber-600" />
                      </div>
                      {item.exchangeSourceOrderItemId ? "Exchange Item Replacement" : "Line Item Details"}
                    </CardTitle>
                    <CardDescription className="pl-14">
                      {item.exchangeSourceOrderItemId
                        ? "Special replacement for an approved exchange. Pack and ship immediately."
                        : "Detailed product metrics and fulfillment tracking."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="flex flex-col gap-8 md:flex-row">
                      <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-muted flex items-center justify-center p-2">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-contain transition-transform hover:scale-110 duration-500" />
                        ) : (
                          <Package className="h-16 w-16 text-muted-foreground/30" />
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                           <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-2xl font-bold tracking-tight text-foreground">{itemName(item)}</h3>
                            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 uppercase tracking-widest">
                              Reference: {item.id.slice(0, 12).toUpperCase()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border-none shadow-md", itemStatusBadgeClass(item.itemStatus))}>
                              {item.itemStatus.replace(/_/g, " ")}
                            </Badge>
                            <Button variant="outline" size="sm" asChild className="h-8 text-[11px] font-bold uppercase tracking-tighter px-4 rounded-full border-primary/20 hover:bg-primary/5 text-primary shadow-sm hover:shadow transition-all">
                              <Link href={`/product-seller/orders/${order.id}/invoice`} target="_blank">
                                Invoice
                              </Link>
                            </Button>
                          </div>
                        </div>

                        {item.exchangeSourceOrderItemId && (
                          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-5 mt-2 transition-all hover:bg-amber-50 shadow-inner">
                            <p className="text-xs font-bold uppercase tracking-widest text-amber-900 flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin-slow" />
                              Active Replacement Shipment
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-amber-950/80 font-medium">
                              Ship this item normally. Status automatically completes the original return when delivered.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-foreground/10 mt-4">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-foreground/70 tracking-widest">Quantity</p>
                            <p className="text-lg font-bold tabular-nums">{item.quantity} units</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-foreground/70 tracking-widest">Unit Price</p>
                            <p className="text-lg font-bold tabular-nums text-primary/80">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-foreground/70 tracking-widest">Tax (GST)</p>
                            <p className={cn("text-lg font-bold tabular-nums", item.hasGst ? "text-emerald-600" : "text-muted-foreground")}>
                              {item.hasGst ? formatCurrency(item.gstAmount) : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-foreground/70 tracking-widest">Total Value</p>
                            <p className="text-xl font-black tabular-nums text-foreground">{formatCurrency(lineTotal(item))}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* C. Shipment timeline redesign */}
                {hist.length > 0 && (
                  <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-muted/5 mt-6">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b bg-muted/20 py-4 px-6">
                      <div className="flex items-center gap-3">
                         <div className="p-1.5 bg-primary/10 rounded-lg">
                            <History className="h-4 w-4 text-primary" />
                         </div>
                         <div>
                            <CardTitle className="text-xs font-bold uppercase tracking-widest">Shipment Log</CardTitle>
                         </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="relative ml-2 space-y-3 border-l-2 border-primary/10 pl-4">
                        {timelineShown.map((h, idx) => {
                          const globalIdx = timelineOffset + idx
                          const isLatest = globalIdx === hist.length - 1
                          return (
                            <li key={`${item.id}-hist-${h.createdAt}-${globalIdx}`} className="relative pb-8 last:pb-0">
                               <div className={cn(
                                "absolute -left-[calc(1rem + 5px)] top-1 flex h-2 w-2 rounded-full ring-2 ring-background",
                                isLatest ? "bg-primary" : "bg-muted-foreground/30"
                               )} />
                               <div
                                 className={cn(
                                   "rounded-xl border p-3",
                                   isLatest ? "border-primary/20 bg-primary/5 shadow-sm" : "border-muted/20 bg-background/50"
                                 )}
                               >
                                 <div className="flex flex-wrap items-center justify-between gap-2">
                                   <div className="flex items-center gap-2">
                                     <Badge className={cn("px-2 py-0 h-4 rounded text-[8px] font-bold uppercase tracking-widest border-none", itemStatusBadgeClass(String(h.status)))}>
                                       {String(h.status).replace(/_/g, " ")}
                                     </Badge>
                                     <span className="text-[9px] font-medium text-muted-foreground/60 tabular-nums">
                                       {new Date(h.createdAt).toLocaleString()}
                                     </span>
                                   </div>
                                 </div>
                                {(h.location || h.note) && (
                                   <div className="mt-2 space-y-1">
                                      {h.location && (
                                        <p className="flex items-center gap-1.5 text-[10px] font-bold text-foreground/70 lowercase">
                                          <MapPin className="h-2.5 w-2.5" /> {h.location}
                                        </p>
                                      )}
                                      {h.note && (
                                        <p className="text-[10px] text-muted-foreground/80 leading-tight italic px-2 border-l border-muted-foreground/20">
                                          {h.note}
                                        </p>
                                      )}
                                   </div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {hasMore && (
                        <div className="mt-8 flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-6 font-bold uppercase tracking-widest text-[10px] hover:bg-primary/5 text-primary transition-all"
                            onClick={() => setTimelineExpanded((prev) => ({ ...prev, [item.id]: !expanded }))}
                          >
                            {expanded ? "Collapse Timeline" : `Explore Full History (${hist.length} Updates)`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* D. Visual Delivery Proof block */}
                {item.deliveryProofImage && (
                  <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CardHeader className="flex flex-row items-center gap-3 border-b bg-emerald-50/50 py-4 px-6">
                      <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-emerald-900">Visual Delivery Proof</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <a href={item.deliveryProofImage} target="_blank" rel="noreferrer" className="group relative block w-fit rounded-xl overflow-hidden border-2 border-muted/20 hover:border-emerald-500/50 transition-colors shadow-sm">
                        <img src={item.deliveryProofImage} alt="Delivery Proof" className="h-48 w-auto object-cover transition-transform duration-500 group-hover:scale-105" />
                      </a>
                    </CardContent>
                  </Card>
                )}

                {/* E. Return / refund / exchange redesign */}
                {item.returnAvailable && !item.exchangeSourceOrderItemId && (
                  <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm animate-in zoom-in-95 duration-500">
                    <CardHeader className="bg-muted/40 p-8 border-b border-muted/20">
                      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-primary/10 rounded-2xl">
                              <RefreshCw className="h-7 w-7 text-primary" />
                           </div>
                           <div className="space-y-1">
                              <CardTitle className="text-2xl font-black tracking-tight">Return Management</CardTitle>
                              <CardDescription className="text-sm font-medium">Customer initiated a resolution request</CardDescription>
                           </div>
                        </div>
                        <div
                          className={cn(
                            "inline-flex w-fit items-center rounded-2xl border-2 px-6 py-2.5 text-xs font-black uppercase tracking-[0.2em] shadow-lg",
                            (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "border-blue-300 bg-blue-50 text-blue-800 shadow-blue-200/50"
                              : "border-amber-400 bg-amber-50 text-amber-900 shadow-amber-200/50",
                          )}
                        >
                          {(item.returnResolutionType ?? "REFUND") === "EXCHANGE" ? "Exchange Req" : "Refund Req"}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                      {(item.returnReason || (item.returnImages?.length ?? 0) > 0) && (
                        <div className="rounded-[2rem] border border-muted/30 bg-muted/5 p-8 space-y-6">
                           <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-primary/60" />
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Reason for Request</p>
                           </div>
                          {item.returnReason && (
                            <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-foreground/80">{item.returnReason}</p>
                          )}
                          {(item.returnImages ?? []).length > 0 && (
                            <div className="mt-6 flex flex-wrap gap-4">
                              {(item.returnImages ?? []).map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative block h-24 w-24 overflow-hidden rounded-2xl border-2 border-muted/20 bg-white transition-all hover:scale-105 hover:shadow-xl active:scale-95"
                                >
                                  <img src={url} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                     <Upload className="w-6 h-6 text-white" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: "Return status", val: item.returnRequestStatus, class: returnRequestBadgeClass },
                          { label: "Pickup status", val: item.pickupStatus, class: pickupBadgeClass },
                          { label: "Refund status", val: item.refundStatus, class: refundBadgeClass }
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-3xl border border-muted/30 bg-background/40 p-6 flex flex-col items-center justify-center text-center gap-3 group hover:border-primary/20 transition-colors">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{stat.label}</p>
                            <Badge className={cn("px-4 py-1.5 rounded-full border-none shadow-inner text-[10px] font-bold tracking-widest uppercase transition-transform group-hover:scale-110", stat.class(stat.val))}>
                              {stat.val ?? "NONE"}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {item.returnRequestStatus === "REQUESTED" && (
                        <div className="flex flex-wrap gap-4 pt-4">
                          <Button
                            size="lg"
                            className="flex-1 md:flex-none rounded-full px-8 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all font-bold uppercase tracking-widest text-[10px]"
                            disabled={returnActionLoadingItemId === item.id}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "ACCEPT",
                                title:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "Authorize Exchange?"
                                    : "Authorize Return?",
                                description:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "The customer's exchange request will be accepted for processing."
                                    : "The customer's return request will be accepted for processing.",
                              })
                            }
                          >
                            {(item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "Authorize Exchange"
                              : "Authorize Return"}
                          </Button>
                          <Button
                            size="lg"
                            variant="destructive"
                            className="flex-1 md:flex-none rounded-full px-8 shadow-lg shadow-red-200 transition-all font-bold uppercase tracking-widest text-[10px]"
                            disabled={returnActionLoadingItemId === item.id}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "REJECT",
                                title:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "Deny Exchange?"
                                    : "Deny Return?",
                                description:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "This will reject the customer's exchange request."
                                    : "This will reject the customer's return request.",
                              })
                            }
                          >
                            {(item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "Deny Exchange"
                              : "Deny Return"}
                          </Button>
                        </div>
                      )}

                      {item.returnRequestStatus === "ACCEPTED" && (item.returnResolutionType ?? "REFUND") === "REFUND" && (
                        <div className="flex flex-wrap gap-4 pt-4">
                          <Button
                            size="lg"
                            variant="default"
                            className="flex-1 md:flex-none rounded-full px-8 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-bold uppercase tracking-widest text-[10px]"
                            disabled={returnActionLoadingItemId === item.id || item.pickupStatus === "COMPLETED"}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "PICKUP_COMPLETED",
                                title: "Confirm Logistical Success?",
                                description:
                                  "Verify the return pickup is complete. The client will be credited in their wallet instantly.",
                              })
                            }
                          >
                            Confirm Pickup
                          </Button>
                          <Button
                            size="lg"
                            className="flex-1 md:flex-none rounded-full px-8 bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all font-bold uppercase tracking-widest text-[10px]"
                            disabled={
                              returnActionLoadingItemId === item.id ||
                              item.pickupStatus !== "COMPLETED" ||
                               item.refundStatus !== "COMPLETED" ||
                              item.itemStatus === "REFUNDED"
                            }
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "REFUND_COMPLETED",
                                title: "Finalize Return Cycle?",
                                description:
                                  "Mark this line as fully refunded and restock inventory.",
                              })
                            }
                          >
                            Finalize Cycle
                          </Button>
                        </div>
                      )}

                      {item.returnRequestStatus === "ACCEPTED" && item.returnResolutionType === "EXCHANGE" && (
                        <div className="space-y-8 pt-4">
                          <div className="rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-violet-600 to-violet-900 p-8 shadow-2xl shadow-violet-200 animate-in slide-in-from-left-8 duration-700">
                            <div className="flex items-start gap-6">
                              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-xl">
                                <ArrowLeftRight className="h-7 w-7" />
                              </span>
                              <div className="min-w-0 space-y-2">
                                <h3 className="text-xl font-black leading-snug text-white uppercase tracking-tight">
                                  Replacement Protocol Active
                                </h3>
                                <p className="text-sm leading-relaxed text-white/80 font-medium">
                                  Execute shipment for the <span className="text-white font-bold">New Line Item</span>. 
                                  The return logistics cycle resolves automatically upon delivery verification of the replacement.
                                </p>
                              </div>
                            </div>
                          </div>

                          {((item.exchangeTopUpAmount ?? 0) > 0.01 ||
                            (item.exchangeRefundDifferenceAmount ?? 0) > 0.01) && (
                            <div className="overflow-hidden rounded-[2.5rem] border border-muted/20 bg-background shadow-xl">
                              <div className="border-b border-muted/20 bg-muted/10 px-8 py-6">
                                <h4 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-foreground">
                                  <Banknote className="h-5 w-5 text-primary" />
                                  Price Equalization
                                </h4>
                                <p className="mt-2 text-xs font-bold text-muted-foreground uppercase opacity-60">
                                  Value adjustment for target replacement vs original item
                                </p>
                              </div>
                              <div className="space-y-6 p-8">
                                {(item.exchangeTopUpAmount ?? 0) > 0.01 && (
                                  <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8 text-amber-950 transition-colors hover:bg-amber-500/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/80 mb-2">
                                      Client Surcharge (Top-up)
                                    </p>
                                    <p className="text-4xl font-black tabular-nums tracking-tighter text-amber-900">
                                      {formatCurrency(item.exchangeTopUpAmount)}
                                    </p>
                                    <p className="mt-4 text-sm font-medium leading-relaxed opacity-80">
                                      Collect this difference as <span className="font-bold">COD</span> at the destination. Record collection to finalize the delta.
                                    </p>
                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-amber-900/10 pt-6">
                                       <span className="text-xs font-bold uppercase tracking-widest text-amber-900/60">
                                          Current Status: {exchangeTopUpCodLabel(item.exchangeTopUpStatus)}
                                       </span>
                                       {item.exchangeTopUpStatus === "PENDING" && (
                                          <Button
                                            size="sm"
                                            className="rounded-full bg-amber-600 text-white hover:bg-amber-700 shadow-md transition-all font-bold uppercase tracking-widest text-[9px] px-6"
                                            disabled={returnActionLoadingItemId === item.id}
                                            onClick={() =>
                                              setConfirmReturn({
                                                itemId: item.id,
                                                action: "EXCHANGE_TOP_UP_RECEIVED",
                                                title: "Verify Collection?",
                                                description: "Confirm receipt of the price difference amount.",
                                              })
                                            }
                                          >
                                            Record Collection
                                          </Button>
                                       )}
                                    </div>
                                  </div>
                                )}

                                {(item.exchangeRefundDifferenceAmount ?? 0) > 0.01 && (
                                  <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-8 text-blue-950 transition-colors hover:bg-blue-500/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/80 mb-2">
                                      Client Reimbursement (Surplus)
                                    </p>
                                    <p className="text-4xl font-black tabular-nums tracking-tighter text-blue-900">
                                      {formatCurrency(item.exchangeRefundDifferenceAmount)}
                                    </p>
                                    <p className="mt-4 text-sm font-medium leading-relaxed opacity-80">
                                      Credited to the customer's secure wallet automatically upon <span className="font-bold">Delivered</span> verification.
                                    </p>
                                    <div className="mt-6 bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-blue-900/5">
                                       <p className="text-[10px] font-bold uppercase tracking-widest text-blue-900/60">
                                          Status: {item.exchangeRefundDifferenceStatus ?? "Awaiting Delivery"}
                                       </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(item.exchangeTopUpAmount ?? 0) <= 0.01 &&
                            (item.exchangeRefundDifferenceAmount ?? 0) <= 0.01 && (
                              <div className="rounded-3xl border border-muted/20 bg-muted/5 p-6 text-center">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pricing Neutral Settlement</p>
                              </div>
                            )}
                        </div>
                      )}

                      {item.replacementOrderItemId && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          Replacement line item: {item.replacementOrderItemId}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* B. Shipment status update redesign */}
                {showShipmentForm && (
                  <Card className="border-none shadow-[LRB] rounded-[3rem] overflow-hidden bg-gradient-to-tr from-background to-amber-500/5 animate-in slide-in-from-right-8 duration-700">
                    <CardHeader className="p-8 border-b border-muted/20 bg-muted/10">
                      <div className="flex items-center gap-4">
                         <div className="p-3 bg-amber-500/10 rounded-2xl shadow-inner">
                            <Truck className="h-7 w-7 text-amber-600" aria-hidden />
                         </div>
                         <div>
                            <CardTitle className="text-2xl font-black tracking-tight">Dispatcher Hub</CardTitle>
                            <CardDescription className="text-sm font-medium">Coordinate the final journey of this item</CardDescription>
                         </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2 flex items-center gap-2">
                             <MapPin className="w-3.5 h-3.5" /> Physical Location
                          </label>
                          <div className="group relative">
                            <input
                              type="text"
                              value={locationDrafts[item.id] ?? ""}
                              onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="City / Hub Terminal"
                              className="h-14 w-full rounded-2xl border-none bg-muted/20 px-6 font-bold text-foreground placeholder:opacity-30 focus:bg-background focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2 flex items-center gap-2">
                             <MessageSquare className="w-3.5 h-3.5" /> Dispatch Note
                          </label>
                          <div className="group relative">
                            <input
                              type="text"
                              value={noteDrafts[item.id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Internal or customer remark"
                              className="h-14 w-full rounded-2xl border-none bg-muted/20 px-6 font-bold text-foreground placeholder:opacity-30 focus:bg-background focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
                            />
                          </div>
                        </div>
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2">Transition to Next Logic Stage</label>
                          <Select
                            value={draftStatus}
                            onValueChange={(value) => setItemStatusDrafts((prev) => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger className="h-14 w-full rounded-2xl border-none bg-muted/20 px-6 font-black uppercase tracking-widest text-xs shadow-inner focus:ring-4 focus:ring-amber-500/20 transition-all">
                              <SelectValue placeholder="Target Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                              {SELLER_ORDER_STATUSES.map((s) => {
                                const currentIndex = SELLER_ORDER_STATUSES.indexOf(item.itemStatus as any)
                                const sIndex = SELLER_ORDER_STATUSES.indexOf(s as any)
                                const isDisabled =
                                  sIndex <= currentIndex ||
                                  (s === "CANCELLED" && (item.itemStatus !== "PENDING" || order.orderHasDeliveredLine))

                                return (
                                  <SelectItem
                                    key={s}
                                    value={s}
                                    disabled={isDisabled}
                                    className="rounded-xl py-3 font-bold uppercase tracking-widest text-[10px]"
                                  >
                                    <span className="flex items-center gap-3">
                                      <span
                                        className={cn(
                                          "inline-block h-2.5 w-2.5 rounded-full shadow-sm",
                                          s === "CONFIRMED" && "bg-emerald-500",
                                          s === "PROCESSING" && "bg-amber-500",
                                          s === "SHIPPED" && "bg-blue-500",
                                          s === "OUT_FOR_DELIVERY" && "bg-violet-500",
                                          s === "DELIVERED" && "bg-emerald-600",
                                          s === "PENDING" && "bg-slate-400",
                                          s === "CANCELLED" && "bg-red-500"
                                        )}
                                      />
                                      {s.replace(/_/g, " ")}
                                    </span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {draftStatus === "DELIVERED" && item.itemStatus === "OUT_FOR_DELIVERY" && (
                        <div className="space-y-4 rounded-3xl bg-violet-600 p-8 text-white shadow-xl shadow-violet-200 animate-in zoom-in-95 duration-500">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 px-1 flex items-center gap-2">
                             <ShieldCheck className="w-4 h-4" /> Secure Delivery Token
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              maxLength={6}
                              value={otpDrafts[item.id] ?? ""}
                              onChange={(e) => setOtpDrafts((prev) => ({ ...prev, [item.id]: e.target.value.replace(/\D/g, "") }))}
                              placeholder="6-DIGIT CODE"
                              className="h-20 w-full rounded-2xl border-none bg-white text-center text-4xl font-black tracking-[1em] text-violet-700 shadow-inner placeholder:text-violet-100 placeholder:tracking-normal focus:ring-8 focus:ring-white/20 transition-all"
                            />
                             <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                <ShieldCheck className="w-8 h-8 opacity-20" />
                             </div>
                          </div>
                          <p className="text-xs font-bold leading-relaxed text-white/80 italic text-center">
                            Verification required for items marked <span className="underline">Out for Delivery</span>.
                          </p>
                        </div>
                      )}

                      {draftStatus === "DELIVERED" && (
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2 flex items-center gap-2">
                             <Upload className="w-3.5 h-3.5" /> Visual Delivery Proof
                          </label>
                          <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                document.getElementById(`delivery-proof-file-${item.id}`)?.click()
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              setDragOverItemId(item.id)
                            }}
                            onDragLeave={() => setDragOverItemId(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setDragOverItemId(null)
                              assignProofFile(item.id, e.dataTransfer.files[0])
                            }}
                            onClick={() => document.getElementById(`delivery-proof-file-${item.id}`)?.click()}
                            className={cn(
                              "relative flex min-h-[220px] flex-col items-center justify-center rounded-[2.5rem] border-4 border-dashed transition-all duration-300",
                              dragOverItemId === item.id
                                ? "border-amber-500 bg-amber-50 scale-95 shadow-inner"
                                : deliveryProofFiles[item.id] || deliveryProofDrafts[item.id]
                                  ? "border-emerald-500/30 bg-emerald-50/20"
                                  : "border-muted/30 bg-muted/10 hover:border-amber-500/50 hover:bg-muted/20"
                            )}
                          >
                            <input
                              id={`delivery-proof-file-${item.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => assignProofFile(item.id, e.target.files?.[0])}
                            />

                            {deliveryProofUploadingItemId === item.id ? (
                               <div className="flex flex-col items-center gap-4">
                                  <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                                  <p className="text-xs font-black uppercase tracking-widest text-amber-600">Encrypting Shipment Proof...</p>
                               </div>
                            ) : deliveryProofFiles[item.id] || deliveryProofDrafts[item.id] ? (
                              <div className="group relative h-48 w-full px-10">
                                <img
                                  src={
                                    deliveryProofFiles[item.id]
                                      ? URL.createObjectURL(deliveryProofFiles[item.id]!)
                                      : deliveryProofDrafts[item.id]
                                  }
                                  alt="Proof"
                                  className="h-full w-full object-contain rounded-2xl shadow-lg ring-4 ring-emerald-500/20"
                                />
                                <div className="absolute inset-x-10 inset-y-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 rounded-2xl">
                                  <p className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                                     <RefreshCw className="w-4 h-4" /> Replace Asset
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-4 px-6 text-center">
                                <div className="p-5 bg-white rounded-full shadow-2xl transition-transform group-hover:scale-110">
                                   <Upload className="h-10 w-10 text-amber-500/70" />
                                </div>
                                <div>
                                   <p className="text-sm font-black text-foreground uppercase tracking-tight">Drop Shipment Evidence</p>
                                   <p className="mt-1 text-[10px] font-bold text-muted-foreground uppercase opacity-60">High-resolution JPEG or PNG (Max 5MB)</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <Button
                        className="h-16 w-full rounded-[2rem] bg-foreground text-background text-sm font-bold uppercase tracking-wider shadow-2xl hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
                        onClick={() => handleUpdateItemStatus(item.id)}
                        disabled={updateLoading || (itemStatusDrafts[item.id] ?? item.itemStatus) === item.itemStatus}
                      >
                        {updateLoading ? (
                           <div className="flex items-center gap-3">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Executing Update...</span>
                           </div>
                        ) : (
                          "Commit Shipment Changes"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </Fragment>
            )
          })}
        </div>

        {/* Right column ~40% redesign */}
        <div className="space-y-8 lg:col-span-2">
          {/* Order Summary Premium Section */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 lg:sticky lg:top-8 animate-in fade-in slide-in-from-right-4 duration-700">
            <CardHeader className="bg-primary/5 py-8 border-b border-primary/10">
              <CardTitle className="flex items-center gap-4 text-xl font-black uppercase tracking-tight">
                <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                  <Receipt className="h-6 w-6 text-primary" aria-hidden />
                </div>
                Order Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid gap-6">
                <div className="flex justify-between items-center p-4 bg-muted/30 rounded-2xl border border-muted-foreground/10 hover:bg-muted/40 transition-colors">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Checkout Method</span>
                  <span className="font-extrabold text-sm uppercase tracking-tighter text-primary/80">{order.paymentMethod ?? "COD"}</span>
                </div>
                
                {/* Customer Section */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 px-1">
                    <User className="w-3.5 h-3.5" /> Client Information
                  </h4>
                  <div className="rounded-3xl bg-background/50 backdrop-blur-md border border-muted/20 p-6 shadow-sm group hover:shadow-md transition-all">
                     <p className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{order.customerName ?? "Guest Client"}</p>
                     <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground lowercase opacity-70">
                           {order.customerEmail ?? "no email provided"}
                        </p>
                        {order.customerPhone && (
                          <p className="text-xs font-bold text-primary flex items-center gap-1.5 pt-1 border-t border-primary/5">
                            <span className="text-[10px] font-medium opacity-50">OTP DEST:</span>
                            {order.customerPhoneCountryCode ? `(+${order.customerPhoneCountryCode.replace(/\D/g, "")}) ` : ""}
                            {order.customerPhone}
                          </p>
                        )}
                     </div>
                    <div className="flex gap-2 mt-4">
                       <Button size="sm" variant="outline" className="h-8 rounded-full text-[10px] font-bold uppercase tracking-widest border-primary/20 hover:bg-primary/5 hover:text-primary shadow-none">
                          View History
                       </Button>
                    </div>
                  </div>
                </div>

                {/* Delivery Section */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 px-1">
                    <MapPin className="w-3.5 h-3.5" /> Shipping Destination
                  </h4>
                  <div className="rounded-3xl bg-muted/40 p-6 space-y-4 border border-muted/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity translate-x-4 -translate-y-4">
                       <MapPin className="w-24 h-24" />
                    </div>
                    {order.shippingFullName ? (
                      <div className="relative space-y-2 text-sm leading-relaxed font-medium">
                        <p className="text-foreground tracking-tight">{order.shippingFullName}</p>
                        <p className="font-black text-primary/70 tabular-nums text-xs">{order.shippingPhone ?? "N/A"}</p>
                        <div className="text-muted-foreground/80 space-y-0.5 text-xs">
                          <p>{order.shippingAddressLine1}</p>
                          {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                          <p>{order.shippingCity}, {order.shippingState} {order.shippingPostalCode}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground/50 italic text-xs py-4 text-center">Unspecified address</p>
                    )}
                  </div>
                </div>

                {/* Billing Summary Redesign */}
                <div className="space-y-5 pt-4 border-t border-muted/30">
                  {priceBreakdown.kind === "exchange" && (
                    <Alert className="border-amber-200 bg-amber-50/50 text-amber-950 rounded-2xl">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-xs font-bold uppercase tracking-wider">Exchange Settlement</AlertTitle>
                      <AlertDescription className="text-[11px] leading-relaxed opacity-80 font-medium">
                        Modified order values based on exchange delta.
                        {priceBreakdown.kind === "exchange" && priceBreakdown.topUp > 0.01 && (
                          <span className="mt-1 block font-bold text-amber-700">
                            Top-up: {formatCurrency(priceBreakdown.topUp)} {priceBreakdown.topUpStatus ? `(${priceBreakdown.topUpStatus.toLowerCase()})` : ""}.
                          </span>
                        )}
                        {priceBreakdown.kind === "exchange" && priceBreakdown.walletCredit > 0.01 && (
                          <span className="mt-1 block font-bold">Wallet Credit: {formatCurrency(priceBreakdown.walletCredit)}.</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Subtotal Gross</span>
                      <span className="font-bold tabular-nums text-foreground/80">
                         {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displaySubtotal : order.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Tax Contribution</span>
                      <span className="font-bold tabular-nums text-emerald-600/80">
                         {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displayTax : order.tax)}
                      </span>
                    </div>

                    {priceBreakdown.kind === "exchange" && priceBreakdown.topUp > 0.01 && (
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600/60">Exchange Top-up</span>
                        <span className="font-bold tabular-nums text-amber-600/80">{formatCurrency(priceBreakdown.topUp)}</span>
                      </div>
                    )}
                    
                    {priceBreakdown.kind === "exchange" && priceBreakdown.walletCredit > 0.01 && (
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-600/60">Wallet Reimbursement</span>
                        <span className="font-bold tabular-nums text-sky-600/80">{formatCurrency(priceBreakdown.walletCredit)}</span>
                      </div>
                    )}

                    {order.shipping > 0 && (
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-amber-600/60">Logistics Fee</span>
                        <span className="font-bold tabular-nums text-amber-600/80">{formatCurrency(order.shipping)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative p-6 rounded-[2rem] bg-foreground text-background shadow-xl overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-50"></div>
                    <div className="relative flex justify-between items-center">
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Settlement Total</p>
                          <p className="text-3xl font-bold tabular-nums tracking-tight">
                             {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.effectiveGrandTotal : order.totalAmount)}
                          </p>
                       </div>
                       <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-white" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!confirmReturn} onOpenChange={(open) => !open && setConfirmReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmReturn?.title}</DialogTitle>
            <DialogDescription>{confirmReturn?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmReturn(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmReturn || returnActionLoadingItemId === confirmReturn.itemId}
              onClick={() => confirmReturn && handleReturnAction(confirmReturn.itemId, confirmReturn.action)}
            >
              {returnActionLoadingItemId === confirmReturn?.itemId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
