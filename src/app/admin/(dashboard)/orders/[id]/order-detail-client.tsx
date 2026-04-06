"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Input } from "@/ui/input"
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
import {
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"

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
        <h1 className="text-2xl font-medium text-foreground">Order details</h1>
        <p className="text-muted-foreground mt-1">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="space-y-6 lg:col-span-3">
          <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
            <CardHeader className="border-b bg-muted/40 py-6">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                Ordered Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-8">
                {orderedItems.map((item) => (
                  <li key={item.id} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-6">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white shadow-inner sm:h-24 sm:w-24">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={itemName(item)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-lg text-foreground">{itemName(item)}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Store className="w-3.5 h-3.5" />
                              {item.sellerStoreName ?? "Store"}
                            </p>
                          </div>
                          <Badge 
                            className={`capitalize font-medium text-[10px] tracking-widest px-3 py-1 rounded-full border-none shadow-sm ${
                              item.itemStatus === "DELIVERED" ? "bg-green-500 text-white" :
                              item.itemStatus === "CANCELLED" ? "bg-destructive text-white" :
                              "bg-primary/10 text-primary"
                            }`}
                          >
                            {item.itemStatus.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        {item.exchangeSourceOrderItemId && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs shadow-sm">
                            <p className="font-medium uppercase tracking-widest text-amber-950 flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5" />
                              Exchange product
                            </p>
                            <p className="mt-1 font-medium text-amber-900 leading-relaxed">
                              This line replaces another item. Original return pickup follows the seller workflow.
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-foreground/70">
                          <span className="font-medium">Qty: <span className="text-foreground font-medium">{item.quantity}</span></span>
                          <span className="font-medium">Price: <span className="text-foreground font-medium">{formatCurrency(item.price)}</span></span>
                          <span className="font-medium text-foreground ml-auto bg-muted/50 px-3 py-1 rounded-lg">
                            {formatCurrency(lineTotal(item))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shipment History UI Improvement */}
                    {item.statusHistory.length > 0 && (
                      <div className="rounded-2xl border border-muted/50 bg-muted/5 p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                          <History className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium uppercase tracking-widest text-foreground">
                            Shipment timeline
                          </span>
                        </div>
                        <ul className="relative ml-2 space-y-0 border-l-2 border-primary/20 pl-6">
                          {item.statusHistory.map((h, idx) => {
                            const isLast = idx === item.statusHistory.length - 1
                            return (
                              <li key={`${item.id}-hist-${idx}`} className="relative pb-6 last:pb-0">
                                <span
                                  className={`absolute -left-[calc(1.5rem+5px)] top-1 flex h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                                    isLast ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30"
                                  }`}
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                                      {String(h.status).replace(/_/g, " ")}
                                    </Badge>
                                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                                      {new Date(h.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {h.location && (
                                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/70">
                                      <MapPin className="h-3 w-3 text-primary/60" />
                                      {h.location}
                                    </p>
                                  )}
                                  {h.note && (
                                    <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-background/50 p-2 rounded-lg border border-muted/30">
                                      "{h.note}"
                                    </p>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                    
                    {/* Item Management Section (Update Status) */}
                    {canUpdateLineItems && item.itemStatus !== "DELIVERED" && (
                      <div className="rounded-2xl border-2 border-primary/5 bg-background p-5 shadow-inner">
                        <div className="flex items-center gap-2 mb-4">
                          <RefreshCw className="w-4 h-4 text-primary" />
                          <h4 className="text-xs font-medium uppercase tracking-widest text-foreground">Update line status</h4>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
                          <label className="space-y-1.5 flex-1">
                            <span className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest px-1">Location</span>
                            <Input
                              value={locationDrafts[item.id] ?? ""}
                              onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Hub / City"
                              className="h-9 bg-muted/20 border-none rounded-xl"
                            />
                          </label>
                          <label className="space-y-1.5 flex-1">
                            <span className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest px-1">Note</span>
                            <Input
                              value={noteDrafts[item.id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Dispatched..."
                              className="h-9 bg-muted/20 border-none rounded-xl"
                            />
                          </label>
                          <label className="space-y-1.5 flex-1">
                            <span className="text-[10px] font-medium uppercase text-muted-foreground tracking-widest px-1">Status</span>
                            <Select
                              value={itemStatusDrafts[item.id] ?? item.itemStatus}
                              onValueChange={(value) => setItemStatusDrafts((prev) => ({ ...prev, [item.id]: value }))}
                            >
                              <SelectTrigger className="h-9 bg-muted/20 border-none rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                {ADMIN_ORDER_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s} className="capitalize">{s.toLowerCase()}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>
                            <Button
                              size="sm"
                              className="h-9 rounded-xl font-medium shadow-lg shadow-primary/20"
                            onClick={() => handleUpdateItemStatus(item.id)}
                            disabled={updateLoading || (itemStatusDrafts[item.id] ?? item.itemStatus) === item.itemStatus}
                          >
                            {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    )}
                    <Separator className="!mt-10" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:col-span-2 lg:sticky lg:top-6 self-start">
          <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary/5 py-5">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/20 p-3 rounded-xl border border-muted/10">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Status</span>
                  <Badge className="bg-primary/10 text-primary border-none font-medium text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
                    {order.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center border-b border-muted/30 pb-4">
                  <span className="text-sm font-medium text-muted-foreground lowercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4" /> Customer
                  </span>
                  <div className="text-right">
                    <p className="font-medium text-sm">{order.customerName ?? "—"}</p>
                    <p className="text-[10px] font-medium text-muted-foreground">{order.customerEmail ?? ""}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-muted/30 pb-4">
                  <span className="text-sm font-medium text-muted-foreground lowercase tracking-widest flex items-center gap-2">
                    <Store className="w-4 h-4" /> Merchant
                  </span>
                  <span className="font-medium text-sm">{order.sellerStoreName ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-muted/30 pb-4">
                  <span className="text-sm font-medium text-muted-foreground lowercase tracking-widest flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Payment
                  </span>
                  <div className="text-right">
                    <p className="font-medium text-sm uppercase">{order.paymentMethod ?? "COD"}</p>
                    <Badge variant="outline" className="text-[9px] h-4 font-medium uppercase tracking-widest">{order.paymentStatus}</Badge>
                  </div>
                </div>
              </div>

              {/* Delivery Address Card Improvement */}
              <div className="rounded-2xl bg-muted/30 p-5 space-y-3">
                <h4 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" /> Shipping Address
                </h4>
                {order.shippingFullName ? (
                  <div className="space-y-1 text-sm leading-relaxed">
                    <p className="font-medium text-foreground">{order.shippingFullName}</p>
                    <p className="font-medium text-muted-foreground tabular-nums text-xs">{order.shippingPhone ?? ""}</p>
                    <p className="text-foreground/80 font-medium">
                      {order.shippingAddressLine1}
                      {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ""}
                    </p>
                    <p className="text-foreground/80 font-medium">
                      {order.shippingCity}, {order.shippingState} {order.shippingPostalCode}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No address provided</p>
                )}
              </div>

              {/* Price Breakdown Redesign */}
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">GST (included)</span>
                    <span className="font-medium text-emerald-600 tabular-nums">{formatCurrency(order.tax)}</span>
                  </div>
                  {order.shipping > 0 && (
                    <div className="flex justify-between text-sm font-medium text-orange-500">
                      <span>Shipping</span>
                      <span className="font-medium tabular-nums">{formatCurrency(order.shipping)}</span>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t-2 border-dashed border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium uppercase tracking-widest text-primary">Grand Total</span>
                    <span className="text-2xl font-medium tabular-nums text-primary">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seller Breakup Redesign */}
          {order.sellerGroups.length > 0 && (
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 py-5">
                <CardTitle className="text-sm font-medium uppercase tracking-widest">Store Breakup</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {order.sellerGroups.map((group) => (
                  <div key={group.sellerId ?? `seller-${group.sellerStoreName ?? "unknown"}`} className="rounded-xl bg-muted/10 border border-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{group.sellerStoreName ?? "Store"}</p>
                      <Badge variant="outline" className="text-[9px] font-medium uppercase tracking-widest border-primary/20 bg-primary/5 text-primary">
                        {group.derivedStatus.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[10px] font-medium text-muted-foreground">
                      <div className="bg-background/50 p-2 rounded-lg">
                        <p className="uppercase tracking-widest mb-1 opacity-60">Subtotal</p>
                        <p className="text-foreground text-xs">{formatCurrency(group.summary.subtotal)}</p>
                      </div>
                      <div className="bg-background/50 p-2 rounded-lg">
                        <p className="uppercase tracking-widest mb-1 opacity-60">Total</p>
                        <p className="text-foreground text-xs font-medium">{formatCurrency(group.summary.total)}</p>
                      </div>
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
