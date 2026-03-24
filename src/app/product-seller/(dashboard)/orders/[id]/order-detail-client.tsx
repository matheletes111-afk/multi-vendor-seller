"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { SellerOrderDetailApi } from "@/app/api/product-seller/orders/types"
import { SELLER_ORDER_STATUSES } from "@/app/api/product-seller/orders/types"
import { Package, MapPin, User, ArrowLeft, Loader2, Receipt, Banknote, ShoppingBag, History, Upload } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

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
  const [returnActionLoadingItemId, setReturnActionLoadingItemId] = useState<string | null>(null)
  const [deliveryProofUploadingItemId, setDeliveryProofUploadingItemId] = useState<string | null>(null)

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

  const canUpdateStatus =
    order &&
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED"

  const handleUpdateItemStatus = async (itemId: string) => {
    if (!order || !canUpdateStatus) return
    const current = order.items.find((item) => item.id === itemId)?.itemStatus
    const next = itemStatusDrafts[itemId]
    if (!next || !current || next === current) return
    if (next === "CANCELLED" && current !== "PENDING") {
      setStatusError("Can only cancel items that are PENDING")
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
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed")
    } finally {
      setUpdateLoading(false)
      setDeliveryProofUploadingItemId(null)
    }
  }

  const handleReturnAction = (itemId: string, action: "ACCEPT" | "REJECT" | "PICKUP_COMPLETED" | "REFUND_COMPLETED") => {
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
      .catch((err: Error) => setStatusError(err.message))
      .finally(() => setReturnActionLoadingItemId(null))
  }

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
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/product-seller/orders" className="flex items-center gap-1">
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

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize">
                {order.status.toLowerCase()}
              </Badge>
            </div>
            {statusError && <p className="text-sm text-destructive">{statusError}</p>}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
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
                    {item.returnAvailable && (
                      <div className="w-full rounded-md border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-700">Return details</p>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Return: {item.returnRequestStatus ?? "NONE"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Pickup: {item.pickupStatus ?? "NOT_REQUESTED"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          Refund: {item.refundStatus ?? "NOT_REQUESTED"}
                        </Badge>
                        </div>
                        {item.returnRequestStatus === "REQUESTED" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={returnActionLoadingItemId === item.id}
                              onClick={() => handleReturnAction(item.id, "ACCEPT")}
                            >
                              Accept Return
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={returnActionLoadingItemId === item.id}
                              onClick={() => handleReturnAction(item.id, "REJECT")}
                            >
                              Reject Return
                            </Button>
                          </div>
                        )}
                        {item.returnRequestStatus === "ACCEPTED" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={returnActionLoadingItemId === item.id || item.pickupStatus === "COMPLETED"}
                              onClick={() => handleReturnAction(item.id, "PICKUP_COMPLETED")}
                            >
                              Mark Pickup Done
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                returnActionLoadingItemId === item.id ||
                                item.pickupStatus !== "COMPLETED" ||
                                item.refundStatus === "COMPLETED"
                              }
                              onClick={() => handleReturnAction(item.id, "REFUND_COMPLETED")}
                            >
                              Mark Refund Done
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {canUpdateStatus && (
                      <div className="mt-2 w-full rounded-md border bg-white p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-700">Update shipment status</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-slate-600">Current location (optional)</span>
                            <input
                              type="text"
                              value={locationDrafts[item.id] ?? ""}
                              onChange={(e) =>
                                setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="e.g. Kolkata Hub"
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-medium text-slate-600">Update note (optional)</span>
                            <input
                              type="text"
                              value={noteDrafts[item.id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="e.g. Packed and dispatched"
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
                                {SELLER_ORDER_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.charAt(0) + s.slice(1).toLowerCase()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>
                          {(itemStatusDrafts[item.id] ?? item.itemStatus) === "DELIVERED" && (
                            <div className="space-y-1 md:col-span-2">
                              <span className="text-[11px] font-medium text-slate-600">
                                Delivery proof image *
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/gif,image/webp"
                                  className="sr-only"
                                  id={`delivery-proof-file-${item.id}`}
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
                                    document.getElementById(`delivery-proof-file-${item.id}`)?.click()
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
                                Image uploads to S3 when you click Save Status Update
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
                                Open proof image
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
                            disabled={updateLoading || (itemStatusDrafts[item.id] ?? item.itemStatus) === item.itemStatus}
                          >
                            {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status Update"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
                      <ul className="relative space-y-0 border-l-2 border-slate-200 pl-4 ml-1.5">
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
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
            <span className="text-muted-foreground">Subtotal ({order.items.length} item(s))</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total GST</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>

          <div className="mt-1 space-y-1.5">
            {order.items.map((item) => {
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
        </CardContent>
      </Card>
    </div>
  )
}
