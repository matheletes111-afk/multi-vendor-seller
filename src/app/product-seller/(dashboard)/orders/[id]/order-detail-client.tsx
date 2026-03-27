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

      {/* Page header */}
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 h-9 gap-1.5 text-slate-600" asChild>
            <Link href="/product-seller/orders">
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to orders
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Order Details</h1>
            <p className="mt-1 font-mono text-sm text-slate-500">Order #{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">ID: {order.id}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge className={cn("border px-3 py-1 text-sm capitalize", orderStatusBadgeClass(order.status))}>
            {order.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Last activity: {lastUpdated ? lastUpdated.toLocaleString() : formatDate(order.createdAt)}
          </p>
          <Badge variant="outline" className="text-xs capitalize">
            Payment: {order.paymentStatus.toLowerCase()}
          </Badge>
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
                {/* A. Product information */}
                <Card className="border-slate-200 shadow-md transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShoppingBag className="h-5 w-5 text-amber-600" aria-hidden />
                      {item.exchangeSourceOrderItemId ? "Exchange product" : "Product information"}
                    </CardTitle>
                    <CardDescription>
                      {item.exchangeSourceOrderItemId
                        ? "Replacement line for an exchange — pack and ship like a normal order."
                        : "Line item details and current fulfillment status"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Package className="h-12 w-12" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-lg font-bold leading-snug text-slate-900">{itemName(item)}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-slate-700">Variant / reference:</span>{" "}
                        {item.id.slice(0, 12)}…
                      </p>
                      {item.exchangeSourceOrderItemId && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                            Exchange product (ship this line)
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-amber-950">
                            Treat this line like a normal order: pack and ship the replacement. When you mark it{" "}
                            <span className="font-medium">delivered</span>, the customer&apos;s original return pickup is
                            closed automatically.
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-slate-600">
                          Qty <span className="font-semibold text-slate-900">{item.quantity}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-600">
                          Unit {formatCurrency(item.price)}
                        </span>
                        <Badge className={cn("border text-[10px] uppercase tracking-wide", itemStatusBadgeClass(item.itemStatus))}>
                          {item.itemStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>Subtotal: {formatCurrency(item.subtotal)}</span>
                        {item.hasGst ? (
                          <span className="text-emerald-700">GST: {formatCurrency(item.gstAmount)}</span>
                        ) : (
                          <span className="text-slate-500">No GST</span>
                        )}
                        <span className="font-semibold text-slate-900">Line total: {formatCurrency(lineTotal(item))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* C. Shipment timeline (before return / shipment update) */}
                {hist.length > 0 && (
                  <Card className="border-slate-200 shadow-md">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <History className="h-5 w-5 text-slate-600" aria-hidden />
                          Shipment timeline
                        </CardTitle>
                        <CardDescription>History of status changes for this line item</CardDescription>
                      </div>
                      <Badge variant="secondary" className="font-normal">
                        {hist.length} update{hist.length !== 1 ? "s" : ""}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <ul className="relative ml-1.5 space-y-0 border-l-2 border-slate-200 pl-5">
                        {timelineShown.map((h, idx) => {
                          const globalIdx = timelineOffset + idx
                          const isLatest = globalIdx === hist.length - 1
                          return (
                            <li key={`${item.id}-hist-${h.createdAt}-${globalIdx}`} className="relative pb-6 last:pb-0">
                              <TimelineDot isLatest={isLatest} />
                              <div
                                className={cn(
                                  "-ml-px rounded-lg border py-3 pl-8 pr-3 sm:pl-9",
                                  isLatest ? "border-l-4 border-l-emerald-500 bg-emerald-50/40" : "border-slate-200 bg-white"
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                  <span className="flex shrink-0 items-center justify-center">
                                    {timelineIconForStatus(String(h.status))}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                                    {String(h.status).replace(/_/g, " ")}
                                  </Badge>
                                  <span className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
                                </div>
                                {h.location ? (
                                  <p className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span>{h.location}</span>
                                  </p>
                                ) : null}
                                {h.note ? (
                                  <p className="mt-2 flex items-start gap-2 text-sm italic text-slate-600">
                                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                    <span>{h.note}</span>
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {hasMore && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => setTimelineExpanded((prev) => ({ ...prev, [item.id]: !expanded }))}
                        >
                          {expanded ? "Show fewer updates" : `Show all updates (${hist.length})`}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* E. Return / refund / exchange */}
                {item.returnAvailable && !item.exchangeSourceOrderItemId && (
                  <Card className="border-slate-200 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <span className="flex items-center gap-2 text-lg">
                          <RefreshCw className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                          <span className="font-semibold text-slate-900">Return request</span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex w-fit items-center rounded-lg border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide shadow-sm",
                            (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "border-blue-300 bg-blue-50 text-blue-800"
                              : "border-amber-300 bg-amber-50 text-amber-900",
                          )}
                        >
                          {(item.returnResolutionType ?? "REFUND") === "EXCHANGE" ? "Exchange" : "Refund"}
                        </span>
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        {(item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                          ? "The customer asked to swap this item for a replacement. Review their submission and approve or reject."
                          : "The customer asked for a refund on this line. Review their submission and approve or reject."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(item.returnReason || (item.returnImages?.length ?? 0) > 0) && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">Customer submission</p>
                          {item.returnReason && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.returnReason}</p>
                          )}
                          {(item.returnImages ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(item.returnImages ?? []).map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-20 w-20 overflow-hidden rounded-md border bg-white shadow-sm"
                                >
                                  <img src={url} alt="" className="h-full w-full object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 p-3 text-center">
                          <p className="text-xs font-medium uppercase text-muted-foreground">Return status</p>
                          <Badge className={cn("mt-2 border", returnRequestBadgeClass(item.returnRequestStatus))}>
                            {item.returnRequestStatus ?? "NONE"}
                          </Badge>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3 text-center">
                          <p className="text-xs font-medium uppercase text-muted-foreground">Pickup status</p>
                          <Badge className={cn("mt-2 border", pickupBadgeClass(item.pickupStatus))}>
                            {item.pickupStatus ?? "NOT_REQUESTED"}
                          </Badge>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3 text-center">
                          <p className="text-xs font-medium uppercase text-muted-foreground">Refund status</p>
                          <Badge className={cn("mt-2 border", refundBadgeClass(item.refundStatus))}>
                            {item.refundStatus ?? "NOT_REQUESTED"}
                          </Badge>
                        </div>
                      </div>

                      {item.returnRequestStatus === "REQUESTED" && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={returnActionLoadingItemId === item.id}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "ACCEPT",
                                title:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "Approve exchange?"
                                    : "Approve return?",
                                description:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "The customer’s exchange request will be accepted."
                                    : "The customer’s return request will be accepted.",
                              })
                            }
                          >
                            {(item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "Approve exchange"
                              : "Approve return"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={returnActionLoadingItemId === item.id}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "REJECT",
                                title:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "Reject exchange?"
                                    : "Reject return?",
                                description:
                                  (item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                                    ? "This will reject the customer’s exchange request."
                                    : "This will reject the customer’s return request.",
                              })
                            }
                          >
                            {(item.returnResolutionType ?? "REFUND") === "EXCHANGE"
                              ? "Reject exchange"
                              : "Reject return"}
                          </Button>
                        </div>
                      )}

                      {item.returnRequestStatus === "ACCEPTED" && (item.returnResolutionType ?? "REFUND") === "REFUND" && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 text-white hover:bg-blue-700"
                            disabled={returnActionLoadingItemId === item.id || item.pickupStatus === "COMPLETED"}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "PICKUP_COMPLETED",
                                title: "Mark pickup complete?",
                                description:
                                  "Confirm that the return pickup has been completed. The customer will receive this line’s amount in their wallet (same as exchange price-difference credits).",
                              })
                            }
                          >
                            Mark pickup complete
                          </Button>
                          <Button
                            size="sm"
                            className="bg-violet-600 text-white hover:bg-violet-700"
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
                                title: "Finalize return?",
                                description:
                                  "Mark this line as refunded and restock the product. Wallet credit was already added when pickup was completed.",
                              })
                            }
                          >
                            Finalize return
                          </Button>
                        </div>
                      )}

                      {item.returnRequestStatus === "ACCEPTED" && item.returnResolutionType === "EXCHANGE" && (
                        <div className="space-y-5">
                          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white px-4 py-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                                <ArrowLeftRight className="h-5 w-5" aria-hidden />
                              </span>
                              <div className="min-w-0 space-y-1.5">
                                <h3 className="text-base font-semibold leading-snug text-violet-950">
                                  Exchange product — shipment
                                </h3>
                                <p className="text-sm leading-relaxed text-violet-900/85">
                                  Use the <span className="font-medium">new line item</span> on this order to ship the
                                  replacement product. Pickup for the returned item completes automatically when that
                                  replacement is marked <span className="font-medium">delivered</span>.
                                </p>
                              </div>
                            </div>
                          </div>

                          {((item.exchangeTopUpAmount ?? 0) > 0.01 ||
                            (item.exchangeRefundDifferenceAmount ?? 0) > 0.01) && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                              <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                  <Banknote className="h-4 w-4 text-slate-600" aria-hidden />
                                  Replacement price adjustment
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                  Shows whether the customer must pay extra for a higher-priced replacement, or receives
                                  wallet credit if the replacement is cheaper. Line totals include tax as on the order.
                                </p>
                              </div>
                              <div className="space-y-4 p-4">
                                {(item.exchangeTopUpAmount ?? 0) > 0.01 && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-amber-950 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                                      Customer pays you (upgrade / top-up)
                                    </p>
                                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
                                      {formatCurrency(item.exchangeTopUpAmount)}
                                    </p>
                                    <p className="mt-1 text-sm text-amber-900/90">
                                      You can ship the replacement anytime. Collect the difference as COD at delivery (or
                                      online). When you have the money, record it below — this does not block shipment.
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-amber-950">
                                      {exchangeTopUpCodLabel(item.exchangeTopUpStatus)}
                                    </p>
                                    {item.exchangeTopUpStatus === "PENDING" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-4 w-full border-amber-300 bg-white hover:bg-amber-100/80 sm:w-auto"
                                        disabled={returnActionLoadingItemId === item.id}
                                        onClick={() =>
                                          setConfirmReturn({
                                            itemId: item.id,
                                            action: "EXCHANGE_TOP_UP_RECEIVED",
                                            title: "Record COD collected?",
                                            description:
                                              "Mark that you received the exchange price difference (e.g. COD at delivery).",
                                          })
                                        }
                                      >
                                        Record COD / payment received
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {(item.exchangeRefundDifferenceAmount ?? 0) > 0.01 && (
                                  <div className="rounded-lg border border-sky-200 bg-sky-50/90 p-4 text-sky-950 shadow-sm">
                                    <div className="flex items-start gap-3">
                                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                                        <Wallet className="h-4 w-4" aria-hidden />
                                      </span>
                                      <div className="min-w-0 flex-1 space-y-3">
                                        <div>
                                          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                                            Credit to customer (cheaper replacement)
                                          </p>
                                          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-sky-950">
                                            {formatCurrency(item.exchangeRefundDifferenceAmount)}
                                          </p>
                                        </div>
                                        <p className="text-sm leading-relaxed text-sky-900/90">
                                          This amount is credited to the customer&apos;s wallet after you mark the
                                          replacement <span className="font-medium">delivered</span>. You do not collect
                                          this — it is handled automatically.
                                        </p>
                                        <div className="rounded-md border border-sky-200/80 bg-white/80 px-3 py-2.5 text-sm text-sky-900">
                                          <span className="font-medium">Status:</span>{" "}
                                          {item.exchangeRefundDifferenceStatus ?? "—"}
                                          {item.exchangeRefundDifferenceStatus === "PENDING"
                                            ? " — credited after replacement is delivered"
                                            : item.exchangeRefundDifferenceStatus === "COMPLETED"
                                              ? " — credited"
                                              : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(item.exchangeTopUpAmount ?? 0) <= 0.01 &&
                            (item.exchangeRefundDifferenceAmount ?? 0) <= 0.01 && (
                              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                                No extra payment or wallet credit applies for this exchange — same or matched price.
                              </p>
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

                {/* B. Shipment status update */}
                {showShipmentForm && (
                  <Card className="border-slate-200 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Truck className="h-5 w-5 text-amber-600" aria-hidden />
                        Update shipment status
                      </CardTitle>
                      <CardDescription>Location and notes are optional unless you mark the item as delivered.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Current location (optional)</span>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                            <input
                              type="text"
                              value={locationDrafts[item.id] ?? ""}
                              onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Enter current city / hub / location"
                              className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                              autoComplete="off"
                            />
                          </div>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Update note (optional)</span>
                          <div className="relative">
                            <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                            <input
                              type="text"
                              value={noteDrafts[item.id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="e.g. Packed and dispatched"
                              className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            />
                          </div>
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-sm font-medium text-slate-700">Next status</span>
                          <Select
                            value={draftStatus}
                            onValueChange={(value) => setItemStatusDrafts((prev) => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger className="h-10 w-full" aria-label="Next shipment status">
                              <SelectValue placeholder="Select next status" />
                            </SelectTrigger>
                            <SelectContent>
                              {SELLER_ORDER_STATUSES.map((s) => (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  disabled={s === "CANCELLED" && order.orderHasDeliveredLine}
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-block h-2 w-2 rounded-full",
                                        s === "CONFIRMED" && "bg-emerald-500",
                                        s === "PROCESSING" && "bg-amber-500",
                                        s === "SHIPPED" && "bg-blue-500",
                                        s === "DELIVERED" && "bg-emerald-600",
                                        s === "PENDING" && "bg-slate-400",
                                        s === "CANCELLED" && "bg-red-500"
                                      )}
                                    />
                                    {s.charAt(0) + s.slice(1).toLowerCase()}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>

                      {draftStatus === "DELIVERED" && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Delivery proof image <span className="text-red-600">*</span>
                          </span>
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
                            onDragLeave={() => setDragOverItemId((id) => (id === item.id ? null : id))}
                            onDrop={(e) => {
                              e.preventDefault()
                              setDragOverItemId(null)
                              assignProofFile(item.id, e.dataTransfer.files?.[0])
                            }}
                            className={cn(
                              "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                              dragOverItemId === item.id
                                ? "border-amber-500 bg-amber-50/50"
                                : "border-slate-300 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/30"
                            )}
                            onClick={() => document.getElementById(`delivery-proof-file-${item.id}`)?.click()}
                          >
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              className="sr-only"
                              id={`delivery-proof-file-${item.id}`}
                              onChange={(e) => {
                                assignProofFile(item.id, e.target.files?.[0])
                                e.target.value = ""
                              }}
                            />
                            <Upload className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
                            <p className="text-sm font-medium text-slate-700">Drag &amp; drop or click to upload</p>
                            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, GIF, WebP — max 5MB. Uploads to S3 when you save.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={deliveryProofUploadingItemId === item.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                document.getElementById(`delivery-proof-file-${item.id}`)?.click()
                              }}
                            >
                              {deliveryProofUploadingItemId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              Choose image
                            </Button>
                            {(deliveryProofDrafts[item.id] || "").trim() ? (
                              <Badge variant="secondary" className="font-normal">
                                Proof on file
                              </Badge>
                            ) : deliveryProofFiles[item.id] ? (
                              <Badge variant="secondary" className="font-normal">
                                Selected: {deliveryProofFiles[item.id]?.name}
                              </Badge>
                            ) : null}
                          </div>
                          {(deliveryProofDrafts[item.id] || "").trim() && (
                            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2">
                              <img
                                src={(deliveryProofDrafts[item.id] || "").trim()}
                                alt="Delivery proof preview"
                                className="h-14 w-14 rounded-md border object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <a
                                  href={(deliveryProofDrafts[item.id] || "").trim()}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-blue-600 underline"
                                >
                                  Open proof image
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 h-7 text-xs text-slate-600"
                                  onClick={() => {
                                    setDeliveryProofDrafts((prev) => ({ ...prev, [item.id]: "" }))
                                    setDeliveryProofFiles((prev) => ({ ...prev, [item.id]: null }))
                                  }}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Remove from draft
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        className="bg-amber-400 text-black hover:bg-amber-500"
                        onClick={() => handleUpdateItemStatus(item.id)}
                        disabled={updateLoading || draftStatus === item.itemStatus || deliveryProofUploadingItemId === item.id}
                      >
                        {updateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save status update
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </Fragment>
            )
          })}
        </div>

        {/* Right column ~40% */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-md lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-amber-600" aria-hidden />
                Order summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order status</span>
                <Badge className={cn("capitalize", orderStatusBadgeClass(order.status))}>
                  {order.status.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order date</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span>
                  {order.paymentMethod ?? "—"} · <span className="capitalize">{order.paymentStatus.toLowerCase()}</span>
                </span>
              </div>
              <Separator />
              <div className="space-y-3">
                {orderedItems.map((item) => {
                  const gst = item.hasGst ? item.gstAmount : 0
                  const totalInclGst = item.subtotalInclGst ?? item.subtotal + gst
                  const isExchangeReplacement = !!item.exchangeSourceOrderItemId
                  return (
                    <div key={`sum-${item.id}`} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{itemName(item)}</p>
                        {isExchangeReplacement && (
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] text-indigo-800">
                            Exchange product
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">Qty {item.quantity}</p>
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Unit price</span>
                          <span>{formatCurrency(item.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(item.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{item.hasGst ? "Taxes (GST)" : "Taxes"}</span>
                          <span>{item.hasGst ? formatCurrency(gst) : "—"}</span>
                        </div>
                        <div className="flex justify-between font-medium text-slate-900">
                          <span>Line total</span>
                          <span>{formatCurrency(totalInclGst)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {priceBreakdown.kind === "exchange" && (
                <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
                  <AlertTitle className="text-sm font-semibold">Exchange (simple view)</AlertTitle>
                  <AlertDescription className="text-xs text-amber-950/90">
                    Customer total = original order + exchange top-up (or wallet credit if cheaper). The replacement line
                    shows the new item value — it is not added on top of the original as a second full charge.
                    {priceBreakdown.topUp > 0.01 && (
                      <span className="mt-1 block">
                        {priceBreakdown.topUpStatus === "COMPLETED"
                          ? `Top-up recorded: ${formatCurrency(priceBreakdown.topUp)} (paid).`
                          : `Top-up due: ${formatCurrency(priceBreakdown.topUp)}.`}
                      </span>
                    )}
                    {priceBreakdown.walletCredit > 0.01 && (
                      <span className="mt-1 block">Wallet credit: {formatCurrency(priceBreakdown.walletCredit)}.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {order.shipping > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(order.shipping)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({order.items.length} item(s))</span>
                <span>
                  {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displaySubtotal : order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total GST</span>
                <span>
                  {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displayTax : order.tax)}
                </span>
              </div>
              {priceBreakdown.kind === "exchange" && priceBreakdown.topUp > 0.01 && (
                <div
                  className={cn(
                    "flex justify-between text-sm font-medium",
                    priceBreakdown.topUpStatus === "COMPLETED" ? "text-emerald-800" : "text-amber-900",
                  )}
                >
                  <span>
                    {priceBreakdown.topUpStatus === "COMPLETED"
                      ? "Exchange top-up (paid)"
                      : "Exchange top-up (extra to pay)"}
                  </span>
                  <span>{formatCurrency(priceBreakdown.topUp)}</span>
                </div>
              )}
              {priceBreakdown.kind === "exchange" && priceBreakdown.walletCredit > 0.01 && (
                <div className="flex justify-between text-sm font-medium text-sky-900">
                  <span>Wallet credit (cheaper exchange)</span>
                  <span>{formatCurrency(priceBreakdown.walletCredit)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
                <span>Grand total</span>
                <span>
                  {formatCurrency(
                    priceBreakdown.kind === "exchange" ? priceBreakdown.effectiveGrandTotal : order.totalAmount,
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-slate-700" aria-hidden />
                Customer &amp; delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Customer</p>
                <p className="mt-1 font-medium text-slate-900">{order.customerName ?? order.customerEmail ?? "—"}</p>
                {order.customerEmail && order.customerName && <p className="text-muted-foreground">{order.customerEmail}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Shipping address</p>
                {order.shippingFullName ? (
                  <div className="mt-2 flex gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    <div>
                      <p className="font-medium text-slate-900">{order.shippingFullName}</p>
                      {order.shippingPhone && <p className="text-slate-700">{order.shippingPhone}</p>}
                      {order.shippingAddressLine1 && (
                        <p className="mt-1 text-slate-700">
                          {order.shippingAddressLine1}
                          {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                          <br />
                          {order.shippingCity}
                          {order.shippingState && `, ${order.shippingState}`}
                          {order.shippingPostalCode && ` ${order.shippingPostalCode}`}
                          {order.shippingCountry && `, ${order.shippingCountry}`}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">—</p>
                )}
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
