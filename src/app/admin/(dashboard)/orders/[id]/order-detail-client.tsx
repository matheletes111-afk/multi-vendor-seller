"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { AdminOrderDetailApi } from "@/app/api/admin/orders/types"
import { ADMIN_ORDER_STATUSES } from "@/app/api/admin/orders/types"
import {
  Package,
  MapPin,
  User,
  ArrowLeft,
  Store,
  Loader2,
  Receipt,
  Banknote,
  ShoppingBag,
  History,
  Upload,
  RefreshCw,
  ArrowLeftRight,
  Wallet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { exchangeTopUpCodLabel } from "@/lib/exchange-top-up-display"
import { flattenOrderItemsForDisplay } from "@/lib/customer-order-item-order"
import { ORDER_CANCEL_BLOCKED_DELIVERED } from "@/lib/order-cancel-guard"

type ReturnAction = "ACCEPT" | "REJECT" | "PICKUP_COMPLETED" | "REFUND_COMPLETED" | "EXCHANGE_TOP_UP_RECEIVED"

export function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [itemStatusDrafts, setItemStatusDrafts] = useState<Record<string, string>>({})
  const [deliveryProofDrafts, setDeliveryProofDrafts] = useState<Record<string, string>>({})
  const [deliveryProofFiles, setDeliveryProofFiles] = useState<Record<string, File | null>>({})
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [deliveryProofUploadingItemId, setDeliveryProofUploadingItemId] = useState<string | null>(null)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [returnActionLoadingItemId, setReturnActionLoadingItemId] = useState<string | null>(null)
  const [confirmReturn, setConfirmReturn] = useState<{
    itemId: string
    action: ReturnAction
    title: string
    description: string
  } | null>(null)

  const uploadDeliveryProofOnSave = async (itemId: string): Promise<string> => {
    const file = deliveryProofFiles[itemId]
    if (!file) throw new Error("Choose a delivery proof image first")
    const fd = new FormData()
    fd.append("file", file)
    fd.append("purpose", "delivery-proof")
    setDeliveryProofUploadingItemId(itemId)
    const res = await fetch("/api/admin/upload", {
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
    return fetch(`/api/admin/orders/${orderId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        if (!res.ok) return null
        return res.json()
      })
      .then((data: AdminOrderDetailApi | null) => {
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

  const handleReturnAction = (itemId: string, action: ReturnAction) => {
    setStatusError(null)
    setReturnActionLoadingItemId(itemId)
    fetch(`/api/admin/orders/${orderId}/items/${itemId}/return-request`, {
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

  const canUpdateLineItems =
    order && order.status !== "CANCELLED" && order.status !== "REFUNDED"

  const handleUpdateItemStatus = async (itemId: string) => {
    if (!order || !canUpdateLineItems) return
    const next = itemStatusDrafts[itemId]
    const current = order.items.find((item) => item.id === itemId)?.itemStatus
    if (!next || !current || next === current) return
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
      const res = await fetch(`/api/admin/orders/${orderId}`, {
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
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed")
    } finally {
      setUpdateLoading(false)
      setDeliveryProofUploadingItemId(null)
    }
  }

  const orderedItems = useMemo(
    () => (order ? flattenOrderItemsForDisplay(order.items) : []),
    [order],
  )

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading order…</p>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Order not found.</p>
            <Button asChild variant="outline">
              <Link href="/admin/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const itemName = (item: AdminOrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"

  const lineTotal = (item: AdminOrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
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

      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/orders" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order details</h1>
        <p className="text-muted-foreground mt-1">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="space-y-6 lg:col-span-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-6">
            {orderedItems.map((item) => (
              <li key={item.id} className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
                <div className="flex gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white sm:h-20 sm:w-20">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={itemName(item)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Package className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-medium text-slate-900">{itemName(item)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {item.itemStatus.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.sellerStoreName ?? "Store"}</span>
                  </div>

                  {item.exchangeSourceOrderItemId && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs">
                      <p className="font-semibold uppercase tracking-wide text-amber-950">Exchange product</p>
                      <p className="mt-1 font-medium text-amber-900">
                        This line replaces another item on the order. Original return pickup follows the seller workflow.
                      </p>
                    </div>
                  )}

                  {item.deliveryProofImage && (
                    <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-2 text-xs">
                      <p className="font-medium text-emerald-900">Delivery proof on file</p>
                      {item.deliveredAt && (
                        <p className="text-[10px] text-emerald-800/80">
                          Delivered: {new Date(item.deliveredAt).toLocaleString()}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <a
                          href={item.deliveryProofImage}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Open proof image
                        </a>
                        <img
                          src={item.deliveryProofImage}
                          alt="Delivery proof"
                          className="h-12 w-12 rounded border object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                    <p className="text-slate-600 text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-600">
                    <span>Qty: {item.quantity}</span>
                    <span>× {formatCurrency(item.price)}</span>
                    <span className="font-medium text-slate-700">
                      Subtotal: {formatCurrency(item.subtotal)}
                    </span>
                    {item.hasGst ? (
                      <span className="text-xs text-emerald-700">
                        GST: {formatCurrency(item.gstAmount)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No GST</span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900">
                    Line total: {formatCurrency(lineTotal(item))}
                  </p>
                </div>
                </div>

                  {item.statusHistory.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-3 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                        <span className="text-xs font-semibold tracking-wide text-slate-700">
                          Shipment timeline
                        </span>
                        <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                          {item.statusHistory.length} update{item.statusHistory.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <ul className="relative ml-1.5 space-y-0 border-l-2 border-slate-200 pl-4">
                        {item.statusHistory.map((h, idx) => {
                          const isLast = idx === item.statusHistory.length - 1
                          return (
                            <li
                              key={`${item.id}-hist-${idx}`}
                              className="relative pb-4 last:pb-0"
                            >
                              <span
                                className={`absolute -left-[calc(0.5rem+5px)] top-1.5 flex h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                                  isLast ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                                aria-hidden
                              />
                              <div className="min-w-0 pl-7 sm:pl-8">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold uppercase tracking-wide"
                                >
                                  {String(h.status).replace(/_/g, " ")}
                                </Badge>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(h.createdAt).toLocaleString()}
                                </span>
                              </div>
                              {h.location ? (
                                <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-600">
                                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                                  <span>{h.location}</span>
                                </p>
                              ) : null}
                              {h.note ? (
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                                  <span className="font-medium text-slate-500">Note: </span>
                                  {h.note}
                                </p>
                              ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {item.returnAvailable && !item.exchangeSourceOrderItemId && (
                    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-3">
                      <p className="flex items-center gap-2 font-medium text-slate-700">
                        <RefreshCw className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                        Return / refund / exchange
                      </p>
                      {(item.returnReason || (item.returnImages?.length ?? 0) > 0) && (
                        <div className="rounded-md border border-slate-100 bg-slate-50/80 p-2">
                          <p className="font-semibold text-slate-900">Customer submission</p>
                          {item.returnReason && (
                            <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.returnReason}</p>
                          )}
                          {(item.returnImages ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(item.returnImages ?? []).map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-16 w-16 overflow-hidden rounded border bg-white"
                                >
                                  <img src={url} alt="" className="h-full w-full object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center">
                          <p className="text-[10px] font-medium uppercase text-muted-foreground">Return</p>
                          <p className="mt-1 font-medium text-slate-900">{item.returnRequestStatus ?? "NONE"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center">
                          <p className="text-[10px] font-medium uppercase text-muted-foreground">Pickup</p>
                          <p className="mt-1 font-medium text-slate-900">{item.pickupStatus ?? "NOT_REQUESTED"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center">
                          <p className="text-[10px] font-medium uppercase text-muted-foreground">Refund</p>
                          <p className="mt-1 font-medium text-slate-900">{item.refundStatus ?? "NOT_REQUESTED"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {item.returnResolutionType === "EXCHANGE" ? "Exchange" : "Refund"}
                        </Badge>
                        {item.replacementAllowed && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-emerald-800">
                            Exchange eligible
                          </Badge>
                        )}
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
                                title: "Accept return?",
                                description: "The customer’s return request will be accepted.",
                              })
                            }
                          >
                            Approve return
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={returnActionLoadingItemId === item.id}
                            onClick={() =>
                              setConfirmReturn({
                                itemId: item.id,
                                action: "REJECT",
                                title: "Reject return?",
                                description: "This will reject the customer’s return request.",
                              })
                            }
                          >
                            Reject return
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
                        <div className="space-y-4">
                          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white px-3 py-3 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                              </span>
                              <div className="min-w-0 space-y-1">
                                <h3 className="text-sm font-semibold leading-snug text-violet-950">
                                  Exchange product — shipment
                                </h3>
                                <p className="text-xs leading-relaxed text-violet-900/85">
                                  Use the <span className="font-medium">new line item</span> on this order to ship the
                                  replacement. Pickup completes when that line is marked{" "}
                                  <span className="font-medium">delivered</span>.
                                </p>
                              </div>
                            </div>
                          </div>

                          {((item.exchangeTopUpAmount ?? 0) > 0.01 || (item.exchangeRefundDifferenceAmount ?? 0) > 0.01) && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                              <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                                <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                                  <Banknote className="h-3.5 w-3.5 text-slate-600" aria-hidden />
                                  Replacement price adjustment
                                </h4>
                              </div>
                              <div className="space-y-3 p-3">
                                {(item.exchangeTopUpAmount ?? 0) > 0.01 && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-amber-950">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                      Customer pays (upgrade / top-up)
                                    </p>
                                    <p className="mt-1 text-xl font-bold tabular-nums">
                                      {formatCurrency(item.exchangeTopUpAmount)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-900/90">{exchangeTopUpCodLabel(item.exchangeTopUpStatus)}</p>
                                    {item.exchangeTopUpStatus === "PENDING" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-3 w-full border-amber-300 bg-white hover:bg-amber-100/80 sm:w-auto"
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
                                  <div className="rounded-lg border border-sky-200 bg-sky-50/90 p-3 text-sky-950">
                                    <div className="flex items-start gap-2">
                                      <Wallet className="h-4 w-4 shrink-0 text-sky-800" aria-hidden />
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                                          Credit to customer (cheaper replacement)
                                        </p>
                                        <p className="text-xl font-bold tabular-nums text-sky-950">
                                          {formatCurrency(item.exchangeRefundDifferenceAmount)}
                                        </p>
                                        <p className="text-xs text-sky-900/90">
                                          Status: {item.exchangeRefundDifferenceStatus ?? "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(item.exchangeTopUpAmount ?? 0) <= 0.01 && (item.exchangeRefundDifferenceAmount ?? 0) <= 0.01 && (
                            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
                              No extra payment or wallet credit — same or matched price.
                            </p>
                          )}
                        </div>
                      )}

                      {item.replacementOrderItemId && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          Replacement line item id: {item.replacementOrderItemId}
                        </p>
                      )}
                    </div>
                  )}

                  {canUpdateLineItems && (
                    <div className="mt-2 w-full rounded-md border bg-white p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-700">Update line item status</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-slate-600">Current location (optional)</span>
                          <input
                            type="text"
                            value={locationDrafts[item.id] ?? ""}
                            onChange={(e) =>
                              setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder="e.g. Hub / city"
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-slate-600">Update note (optional)</span>
                          <input
                            type="text"
                            value={noteDrafts[item.id] ?? ""}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="e.g. Dispatched"
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-medium text-slate-600">Next status</span>
                          <Select
                            value={itemStatusDrafts[item.id] ?? item.itemStatus}
                            onValueChange={(value) => setItemStatusDrafts((prev) => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue placeholder="Change item status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ADMIN_ORDER_STATUSES.map((s) => (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  disabled={s === "CANCELLED" && order.orderHasDeliveredLine}
                                >
                                  {s.charAt(0) + s.slice(1).toLowerCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                        {(itemStatusDrafts[item.id] ?? item.itemStatus) === "DELIVERED" && (
                          <div className="space-y-1 md:col-span-2">
                            <span className="text-[11px] font-medium text-slate-600">Delivery proof image *</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="sr-only"
                                id={`admin-delivery-proof-${item.id}`}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) {
                                    setDeliveryProofFiles((prev) => ({ ...prev, [item.id]: f }))
                                    setDeliveryProofDrafts((prev) => ({ ...prev, [item.id]: "" }))
                                  }
                                  e.target.value = ""
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5"
                                disabled={deliveryProofUploadingItemId === item.id}
                                onClick={() =>
                                  document.getElementById(`admin-delivery-proof-${item.id}`)?.click()
                                }
                              >
                                {deliveryProofUploadingItemId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                {deliveryProofUploadingItemId === item.id ? "Uploading…" : "Choose image"}
                              </Button>
                              {(deliveryProofDrafts[item.id] || "").trim() ? (
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  Image ready
                                </Badge>
                              ) : deliveryProofFiles[item.id] ? (
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  Selected: {deliveryProofFiles[item.id]?.name}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Image uploads to S3 when you click Save status update
                            </p>
                          </div>
                        )}
                      </div>
                      {(itemStatusDrafts[item.id] ?? item.itemStatus) === "DELIVERED" &&
                        (deliveryProofDrafts[item.id] || "").trim() && (
                          <div className="mt-2 flex items-center gap-3">
                            <a
                              href={(deliveryProofDrafts[item.id] || "").trim()}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 underline"
                            >
                              Open selected proof
                            </a>
                            <img
                              src={(deliveryProofDrafts[item.id] || "").trim()}
                              alt="Delivery proof preview"
                              className="h-10 w-10 rounded border object-cover"
                            />
                          </div>
                        )}
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateItemStatus(item.id)}
                          disabled={
                            updateLoading || (itemStatusDrafts[item.id] ?? item.itemStatus) === item.itemStatus
                          }
                        >
                          {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save status update"}
                        </Button>
                      </div>
                    </div>
                  )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
        </div>

        <aside className="space-y-6 lg:col-span-2 lg:sticky lg:top-6 self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Order summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order status</span>
              <Badge variant="outline" className="capitalize">{order.status.replace(/_/g, " ").toLowerCase()}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{order.sellerStoreName ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.paymentMethod ?? "—"} ({order.paymentStatus.toLowerCase()})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.shippingFullName ? (
              <>
                <p className="font-medium text-foreground">{order.shippingFullName}</p>
                {order.shippingPhone && <p>{order.shippingPhone}</p>}
                {order.shippingAddressLine1 && (
                  <p className="mt-1">
                    {order.shippingAddressLine1}
                    {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                    <br />
                    {order.shippingCity}
                    {order.shippingState && `, ${order.shippingState}`}
                    {order.shippingPostalCode && ` ${order.shippingPostalCode}`}
                    {order.shippingCountry && `, ${order.shippingCountry}`}
                  </p>
                )}
              </>
            ) : (
              <p>—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium text-foreground">{order.customerName ?? order.customerEmail ?? "—"}</p>
            {order.customerEmail && order.customerName && (
              <p className="text-muted-foreground">{order.customerEmail}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Seller / Store
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium text-foreground">{order.sellerStoreName ?? "—"}</p>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Price breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({orderedItems.length} line(s))</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total GST</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>

          <div className="mt-1 space-y-1.5">
            {orderedItems.map((item) => {
              const gst = item.hasGst ? item.gstAmount : 0
              const totalInclGst = item.subtotalInclGst ?? item.subtotal + gst
              return (
                <div key={item.id} className="flex justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.productNameSnapshot || item.serviceNameSnapshot || "Item"} (x{item.quantity})
                  </span>
                  <span className="text-right">
                    <span className="text-muted-foreground">
                      {formatCurrency(item.subtotal)} {gst > 0 ? `+ GST ${formatCurrency(gst)}` : "+ No GST"}
                    </span>
                    <span className="block font-medium text-slate-900">{formatCurrency(totalInclGst)}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {order.shipping > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatCurrency(order.shipping)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Grand total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Commission ({order.commissionRate}%)</span>
            <span className="font-medium text-destructive">-{formatCurrency(order.commission)}</span>
          </div>
        </CardContent>
      </Card>

      {order.sellerGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seller-wise breakup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.sellerGroups.map((group) => (
              <div key={group.sellerId ?? `seller-${group.sellerStoreName ?? "unknown"}`} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{group.sellerStoreName ?? "Store"}</p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {group.derivedStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
                  <p>Items: {group.itemCount}</p>
                  <p>Subtotal: {formatCurrency(group.summary.subtotal)}</p>
                  <p>Tax: {formatCurrency(group.summary.tax)}</p>
                  <p>Shipping: {formatCurrency(group.summary.shipping)}</p>
                  <p className="font-medium text-foreground">Total: {formatCurrency(group.summary.total)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
        </aside>
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
