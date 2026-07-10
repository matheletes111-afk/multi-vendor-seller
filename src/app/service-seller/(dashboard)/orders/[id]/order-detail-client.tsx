"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { SellerOrderDetailApi } from "@/app/api/service-seller/orders/types"
import {
  SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS,
} from "@/app/api/service-seller/orders/types"
import {
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"
import { Package, MapPin, User, ArrowLeft, Loader2, Receipt, Banknote, ShoppingBag, Upload, ExternalLink } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

/** Dropdown options: service flow excludes shipping-style statuses; keep legacy if item already has one. */
function lineItemStatusSelectValues(currentItemStatus: string): string[] {
  const base: string[] = [...SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS]
  if (
    (currentItemStatus === "PROCESSING" || currentItemStatus === "SHIPPED") &&
    !base.includes(currentItemStatus)
  ) {
    base.push(currentItemStatus)
  }
  return base
}

export function ServiceSellerOrderDetailClient({ orderId }: { orderId: string }) {
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
  const [deliveryProofUploadingItemId, setDeliveryProofUploadingItemId] = useState<string | null>(null)
  /** Local blob URLs for file picker preview before upload */
  const [deliveryProofFilePreview, setDeliveryProofFilePreview] = useState<Record<string, string>>({})

  const uploadDeliveryProofOnSave = async (itemId: string): Promise<string> => {
    const file = deliveryProofFiles[itemId]
    if (!file) throw new Error("Choose a delivery proof image first")
    const fd = new FormData()
    fd.append("file", file)
    fd.append("purpose", "delivery-proof")
    setDeliveryProofUploadingItemId(itemId)
    const res = await fetch("/api/service-seller/upload", {
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
    return fetch(`/api/service-seller/orders/${orderId}`, { credentials: "include" })
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
          setDeliveryProofFilePreview((prev) => {
            Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
            return {}
          })
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
    return () => {
      Object.values(deliveryProofFilePreview).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [deliveryProofFilePreview])

  const canUpdateStatus =
    order &&
    order.status !== "CANCELLED" &&
    order.status !== "REFUNDED"

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
      const res = await fetch(`/api/service-seller/orders/${orderId}`, {
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
      setDeliveryProofFilePreview((prev) => {
        const u = prev[itemId]
        if (u) URL.revokeObjectURL(u)
        const { [itemId]: _, ...rest } = prev
        return rest
      })
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed")
    } finally {
      setUpdateLoading(false)
      setDeliveryProofUploadingItemId(null)
    }
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
              <Link href="/service-seller/orders">Back to orders</Link>
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
        <Link href="/service-seller/orders" className="flex items-center gap-1">
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
            {order.items.map((item) => {
              const draftStatus = itemStatusDrafts[item.id] ?? item.itemStatus
              const draftProofUrl = (deliveryProofDrafts[item.id] || "").trim()
              const proofPreviewUrl =
                draftProofUrl ||
                deliveryProofFilePreview[item.id] ||
                (item.itemStatus === "DELIVERED" ? item.deliveryProofImage : null) ||
                ""
              const showDeliveryProofPreview =
                proofPreviewUrl &&
                (item.itemStatus === "DELIVERED" || draftStatus === "DELIVERED")

              return (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {item.itemStatus.replace(/_/g, " ")}
                      </Badge>
                      <Button variant="outline" size="sm" asChild className="h-6 text-[10px] px-2 rounded-lg border-primary/20 hover:bg-primary/5 text-primary font-bold uppercase tracking-tighter">
                        <Link href={`/service-seller/orders/${order.id}/invoice`} target="_blank">
                          Invoice
                        </Link>
                      </Button>
                    </div>
                    {canUpdateStatus && item.itemStatus !== "DELIVERED" && (
                      <>
                        {(itemStatusDrafts[item.id] ?? item.itemStatus) === "DELIVERED" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              className="sr-only"
                              id={`delivery-proof-file-${item.id}`}
                              onChange={async (e) => {
                                let f = e.target.files?.[0]
                                if (f) {
                                  try {
                                    const { compressImage } = await import("@/lib/image-compressor")
                                    f = await compressImage(f)
                                  } catch (err) {
                                    console.error("Compression error:", err)
                                  }
                                  
                                  setDeliveryProofFilePreview((prev) => {
                                    const old = prev[item.id]
                                    if (old) URL.revokeObjectURL(old)
                                    return { ...prev, [item.id]: URL.createObjectURL(f!) }
                                  })
                                  setDeliveryProofFiles((prev) => ({ ...prev, [item.id]: f! }))
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
                            ) : (
                              <span className="text-[10px] text-amber-700">Required for delivered</span>
                            )}
                          </div>
                        )}
                        <input
                          type="text"
                          value={locationDrafts[item.id] ?? ""}
                          onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Current location (optional)"
                          className="h-8 w-[210px] rounded-md border border-input bg-background px-2 text-xs"
                        />
                        <input
                          type="text"
                          value={noteDrafts[item.id] ?? ""}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Update note (optional)"
                          className="h-8 w-[210px] rounded-md border border-input bg-background px-2 text-xs"
                        />
                        <Select
                          value={itemStatusDrafts[item.id] ?? item.itemStatus}
                          onValueChange={(value) => setItemStatusDrafts((prev) => ({ ...prev, [item.id]: value }))}
                        >
                          <SelectTrigger className="h-8 w-[170px]">
                            <SelectValue placeholder="Change item status" />
                          </SelectTrigger>
                          <SelectContent>
                            {lineItemStatusSelectValues(item.itemStatus).map((s) => {
                              const options = SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS
                              // Logical rank for forward-only check
                              const getRank = (status: string) => {
                                if (status === "PENDING") return 0
                                if (status === "CONFIRMED") return 1
                                if (status === "PROCESSING") return 2
                                if (status === "SHIPPED") return 3
                                if (status === "DELIVERED") return 4
                                if (status === "CANCELLED") return 5
                                return -1
                              }
                              const currentRank = getRank(item.itemStatus)
                              const sRank = getRank(s)
                              
                              const isDisabled =
                                (sRank !== -1 && currentRank !== -1 && sRank <= currentRank) ||
                                (s === item.itemStatus) ||
                                (s === "CANCELLED" && (item.itemStatus !== "PENDING" || order.orderHasDeliveredLine))

                              return (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  disabled={isDisabled}
                                >
                                  {s.charAt(0) + s.slice(1).toLowerCase()}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateItemStatus(item.id)}
                          disabled={updateLoading || (itemStatusDrafts[item.id] ?? item.itemStatus) === item.itemStatus}
                        >
                          {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                        </Button>
                      </>
                    )}
                  </div>
                  {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                    <p className="text-slate-600 text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                  )}
                  {item.itemStatus === "CANCELLED" && item.serviceNameSnapshot && !item.productNameSnapshot && (
                    <p className="text-xs font-medium text-emerald-800">
                      The service time slot was released and is available to book again.
                    </p>
                  )}
                  {showDeliveryProofPreview && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofPreviewUrl}
                        alt="Delivery proof"
                        className="h-24 w-24 rounded-md border object-cover sm:h-28 sm:w-28"
                      />
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-700">Delivery proof</span>
                        <a
                          href={proofPreviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 underline"
                        >
                          Open full size <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                  {item.statusHistory.length > 0 && (
                    <div className="mt-1 space-y-1 rounded-md bg-white/60 p-2 text-[11px]">
                      {item.statusHistory.map((h, idx) => (
                        <p key={`${item.id}-hist-${idx}`} className="text-slate-600">
                          {new Date(h.createdAt).toLocaleString()} - {h.status}
                          {h.location ? ` @ ${h.location}` : ""}
                          {h.note ? ` (${h.note})` : ""}
                        </p>
                      ))}
                    </div>
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
              </li>
            )})}
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
          {order.couponDiscount && order.couponDiscount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 font-bold">
              <span>Coupon Discount ({order.couponCode})</span>
              <span>-{formatCurrency(order.couponDiscount)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-base pt-1">
            <span>Grand total (your lines)</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2">
            <span className="text-muted-foreground">Platform fee ({order.commissionRate}%)</span>
            <span className="tabular-nums">−{formatCurrency(order.commission)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-base text-emerald-900">
            <span>Your net (after fees)</span>
            <span className="tabular-nums">{formatCurrency(order.sellerNet)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
