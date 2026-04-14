"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Label } from "@/ui/label"
import { cn, formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import {
  MAX_RETURN_IMAGES,
  MIN_RETURN_IMAGES,
  MIN_RETURN_REASON_LENGTH,
} from "@/lib/return-request-validation"
import { CustomerOrderReviewSection, type CustomerReviewDraft } from "./customer-order-review-section"
import { CustomerReturnExchangeStatusDashboard } from "./customer-return-exchange-status-dashboard"
import {
  ExchangeCurrentVsReplacement,
  ExchangeVariantImageGrid,
  type ExchangeCurrentVariantInfo,
  type ExchangeVariantOption,
} from "./exchange-modal-product-panels"
import { getExchangeOrderPriceBreakdown } from "@/lib/exchange-order-display"
import { flattenOrderItemsForCustomerDisplay } from "@/lib/customer-order-item-order"
import {
  Package,
  MapPin,
  Banknote,
  Receipt,
  ShoppingBag,
  Minus,
  Upload,
  CheckCircle2,
  Store,
} from "lucide-react"
import Link from "next/link"

export function OrderDetailInline({
  order,
  onClose,
  onReviewSaved,
}: {
  order: OrderDetailApi
  onClose: () => void
  onReviewSaved?: (orderId: string) => Promise<void> | void
}) {
  const [drafts, setDrafts] = useState<Record<string, CustomerReviewDraft>>({})

  const [editingReview, setEditingReview] = useState<Record<string, boolean>>({})
  const [returnLoadingItemId, setReturnLoadingItemId] = useState<string | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundDialogItemId, setRefundDialogItemId] = useState<string | null>(null)
  const [returnReasonDraft, setReturnReasonDraft] = useState("")
  /** Local files; S3 upload on submit via /api/customer/review-upload (uploadPublicFile → S3). */
  const [returnPhotos, setReturnPhotos] = useState<{ files: File[]; previews: string[] }>({
    files: [],
    previews: [],
  })
  const [returnUploading, setReturnUploading] = useState(false)
  const [exchangeItemId, setExchangeItemId] = useState<string | null>(null)
  const [exchangeProductName, setExchangeProductName] = useState<string | null>(null)
  const [exchangeCurrentVariant, setExchangeCurrentVariant] = useState<ExchangeCurrentVariantInfo | null>(null)
  const [exchangeVariants, setExchangeVariants] = useState<ExchangeVariantOption[]>([])
  const [selectedExchangeVariantId, setSelectedExchangeVariantId] = useState("")
  const [exchangeOptionsLoading, setExchangeOptionsLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const isObjectUrl = (url: string) => url.startsWith("blob:")

  const priceBreakdown = useMemo(() => getExchangeOrderPriceBreakdown(order), [order])

  const itemName = (item: OrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"
  const lineTotal = (item: OrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount
  const returnLabel = (item: OrderDetailApi["items"][number]) => {
    if (item.returnAvailable) {
      const days = item.returnPolicyDays ?? 0
      return days > 0 ? `Return (${days} days)` : "Return"
    }
    return "No return"
  }

  const deliveredAtIso = (item: OrderDetailApi["items"][number]): string | null => {
    const hist = item.statusHistory
    for (let i = hist.length - 1; i >= 0; i--) {
      if (String(hist[i].status).toUpperCase().includes("DELIVER")) return hist[i].createdAt
    }
    return null
  }

  const emptyReviewDraft = (): CustomerReviewDraft => ({
    rating: 0,
    comment: "",
    files: [],
    previewUrls: [],
    submitting: false,
    error: null,
  })
  const getDraft = (itemId: string) => drafts[itemId] ?? emptyReviewDraft()
  const patchDraft = (itemId: string, patch: Partial<CustomerReviewDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyReviewDraft()), ...patch },
    }))
  }

  const submitReview = async (
    item: OrderDetailApi["items"][number],
    method: "POST" | "PATCH" = "POST"
  ) => {
    const draft = getDraft(item.id)
    if (draft.submitting) return
    if (draft.rating < 1 || draft.rating > 5) {
      patchDraft(item.id, { error: "Please select a star rating." })
      return
    }
    patchDraft(item.id, { submitting: true, error: null })
    try {
      const uploadedUrls: string[] = []
      for (const file of draft.files) {
        const fd = new FormData()
        fd.append("file", file)
        const uploadRes = await fetch("/api/customer/review-upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        })
        const uploadJson = await uploadRes.json().catch(() => ({}))
        if (!uploadRes.ok || typeof uploadJson?.url !== "string") {
          throw new Error(uploadJson?.error || "Image upload failed")
        }
        uploadedUrls.push(uploadJson.url)
      }

      // Build final image URLs in the same order as `draft.previewUrls`.
      // - Existing images are plain URLs already.
      // - Newly selected images are `blob:` URLs and must be replaced with uploaded URLs.
      let uploadedIdx = 0
      const finalImageUrls = draft.previewUrls
        .map((previewUrl) => {
          if (isObjectUrl(previewUrl)) {
            return uploadedUrls[uploadedIdx++] ?? null
          }
          return previewUrl
        })
        .filter((u): u is string => typeof u === "string" && u.length > 0)
        .slice(0, 5)

      const res = await fetch(`/api/customer/orders/${order.id}/items/${item.id}/review`, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating: draft.rating,
          comment: draft.comment,
          imageUrls: finalImageUrls,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Failed to submit review")
      }

      // Clear selected images and revoke their object URLs.
      try {
        for (const url of draft.previewUrls) {
          if (isObjectUrl(url)) URL.revokeObjectURL(url)
        }
      } catch {
        /* ignore */
      }
      patchDraft(item.id, { rating: 0, comment: "", files: [], previewUrls: [], submitting: false, error: null })
      if (method === "PATCH") setEditingReview((prev) => ({ ...prev, [item.id]: false }))
      await onReviewSaved?.(order.id)
    } catch (error) {
      patchDraft(item.id, {
        submitting: false,
        error: error instanceof Error ? error.message : "Failed to submit review",
      })
    }
  }

  /** Uploads one image to S3 via /api/customer/review-upload (folder: return-images). */
  const uploadReturnPhoto = async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("purpose", "return")
    const res = await fetch("/api/customer/review-upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || typeof data.url !== "string") {
      throw new Error(data.error ?? "Image upload failed")
    }
    return data.url
  }

  const resetReturnPhotos = () => {
    setReturnPhotos((prev) => {
      prev.previews.forEach((u) => {
        if (u.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(u)
          } catch {
            /* ignore */
          }
        }
      })
      return { files: [], previews: [] }
    })
  }

  const addReturnPhotos = (incoming: File[]) => {
    if (incoming.length === 0) return
    setReturnPhotos((prev) => {
      const oldPreviews = prev.previews
      const nextFiles = [...prev.files, ...incoming].slice(0, MAX_RETURN_IMAGES)
      const nextPreviews = nextFiles.map((f) => URL.createObjectURL(f))
      queueMicrotask(() => {
        oldPreviews.forEach((u) => {
          if (u.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(u)
            } catch {
              /* ignore */
            }
          }
        })
      })
      return {
        files: nextFiles,
        previews: nextPreviews,
      }
    })
  }

  const removeReturnPhotoAt = (idx: number) => {
    setReturnPhotos((prev) => {
      const oldPreviews = prev.previews
      const nextFiles = prev.files.filter((_, i) => i !== idx)
      const nextPreviews = nextFiles.map((f) => URL.createObjectURL(f))
      queueMicrotask(() => {
        oldPreviews.forEach((u) => {
          if (u.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(u)
            } catch {
              /* ignore */
            }
          }
        })
      })
      return {
        files: nextFiles,
        previews: nextPreviews,
      }
    })
  }

  const submitReturnRequest = async (
    itemId: string,
    resolutionType: "REFUND" | "EXCHANGE",
    opts: { replacementVariantId?: string; reason: string; returnImages: string[] }
  ) => {
    setReturnError(null)
    setReturnLoadingItemId(itemId)
    try {
      const res = await fetch(`/api/customer/orders/${order.id}/items/${itemId}/return-request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionType,
          reason: opts.reason,
          returnImages: opts.returnImages,
          ...(resolutionType === "EXCHANGE" && opts.replacementVariantId
            ? { replacementVariantId: opts.replacementVariantId }
            : {}),
        }),
      })
      const json = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(json?.error || "Failed to request return")
      setExchangeOpen(false)
      setExchangeItemId(null)
      setRefundDialogOpen(false)
      setRefundDialogItemId(null)
      setReturnReasonDraft("")
      resetReturnPhotos()
      await onReviewSaved?.(order.id)
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Failed to request return")
    } finally {
      setReturnLoadingItemId(null)
    }
  }

  const openRefundDialog = (itemId: string) => {
    setReturnError(null)
    setRefundDialogItemId(itemId)
    setReturnReasonDraft("")
    resetReturnPhotos()
    setRefundDialogOpen(true)
  }

  const openExchangeDialog = async (itemId: string) => {
    setReturnError(null)
    setExchangeOptionsLoading(true)
    try {
      const res = await fetch(`/api/customer/orders/${order.id}/items/${itemId}/exchange-options`, {
        credentials: "include",
      })
      const json = await res.json().catch(() => ({} as { error?: string; variants?: unknown }))
      if (!res.ok) throw new Error(json?.error || "Could not load exchange options")
      const j = json as {
        variants?: unknown
        productName?: string | null
        currentVariant?: ExchangeCurrentVariantInfo | null
      }
      const variants = (j.variants ?? []) as ExchangeVariantOption[]
      const line = order.items.find((i) => i.id === itemId)
      const fallbackName = line ? itemName(line) : "Item"
      setExchangeProductName(j.productName ?? fallbackName)
      setExchangeCurrentVariant(j.currentVariant ?? null)
      setExchangeItemId(itemId)
      setExchangeVariants(variants)
      const firstOk = variants.find((v) => v.eligible)
      setSelectedExchangeVariantId(firstOk?.id ?? "")
      setReturnReasonDraft("")
      resetReturnPhotos()
      setExchangeOpen(true)
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Failed to load variants")
    } finally {
      setExchangeOptionsLoading(false)
    }
  }

  const handleRefundSubmit = async () => {
    if (!refundDialogItemId) return
    setReturnError(null)
    setReturnUploading(true)
    let urls: string[] = []
    try {
      for (const file of returnPhotos.files) {
        urls.push(await uploadReturnPhoto(file))
      }
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Image upload failed")
      setReturnUploading(false)
      return
    }
    setReturnUploading(false)
    await submitReturnRequest(refundDialogItemId, "REFUND", {
      reason: returnReasonDraft,
      returnImages: urls,
    })
  }

  const handleExchangeSubmit = async () => {
    if (!exchangeItemId) return
    setReturnError(null)
    setReturnUploading(true)
    let urls: string[] = []
    try {
      for (const file of returnPhotos.files) {
        urls.push(await uploadReturnPhoto(file))
      }
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Image upload failed")
      setReturnUploading(false)
      return
    }
    setReturnUploading(false)
    await submitReturnRequest(exchangeItemId, "EXCHANGE", {
      replacementVariantId: selectedExchangeVariantId,
      reason: returnReasonDraft,
      returnImages: urls,
    })
  }

  const canCancelOrder = order.items.length > 0 && order.items.every((item) => item.itemStatus === "PENDING")
  const cancelOrder = async () => {
    if (!canCancelOrder || cancelLoading) return
    setCancelError(null)
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/customer/orders/${order.id}/cancel`, {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(json?.error || "Failed to cancel order")
      await onReviewSaved?.(order.id)
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Failed to cancel order")
    } finally {
      setCancelLoading(false)
    }
  }

  const exchangeLineItem = order.items.find((i) => i.id === exchangeItemId) ?? null
  const selectedExchangeVariant = exchangeVariants.find((v) => v.id === selectedExchangeVariantId) ?? null
  const returnReasonLen = returnReasonDraft.trim().length
  const exchangeSelVariant = exchangeVariants.find((v) => v.id === selectedExchangeVariantId)
  const exchangeConfirmDisabled =
    !exchangeItemId ||
    !selectedExchangeVariantId ||
    exchangeSelVariant?.eligible !== true ||
    returnReasonLen < MIN_RETURN_REASON_LENGTH ||
    returnPhotos.files.length < MIN_RETURN_IMAGES ||
    returnUploading ||
    returnLoadingItemId === exchangeItemId
  const refundConfirmDisabled =
    !refundDialogItemId ||
    returnReasonLen < MIN_RETURN_REASON_LENGTH ||
    returnPhotos.files.length < MIN_RETURN_IMAGES ||
    returnUploading ||
    (refundDialogItemId ? returnLoadingItemId === refundDialogItemId : false)

  const orderedItems = flattenOrderItemsForCustomerDisplay(order.items)

  return (
    <div className="mt-2 space-y-5 rounded-xl border border-gray-200 bg-[#f9fafb] p-5 font-sans shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200/80 pb-4">
        <div>
          <p className="font-mono text-sm text-gray-500">#{order.orderNumber}</p>
          <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 -mr-2 rounded-lg text-gray-500 transition-colors duration-200 hover:bg-white hover:text-gray-900"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-gray-200 bg-white shadow-sm transition-shadow duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Receipt className="h-4 w-4 text-blue-600" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
              <span className="text-sm text-gray-500">Status</span>
              <Badge variant="outline" className="w-fit capitalize border-gray-200 bg-white text-xs font-medium text-gray-800">
                {order.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
              <span className="text-sm text-gray-500">Store</span>
              <span className="font-medium text-gray-900">{order.sellerStoreName ?? "—"}</span>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
              <span className="text-sm text-gray-500">Payment</span>
              <span className="text-gray-800">
                {order.paymentMethod ?? "—"} <span className="text-gray-500">({order.paymentStatus.toLowerCase()})</span>
              </span>
            </div>
            {canCancelOrder && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelOrder}
                  disabled={cancelLoading}
                  className="h-9 rounded-lg border-gray-300 text-xs font-medium transition-all duration-200 hover:bg-gray-50"
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Order"}
                </Button>
              </div>
            )}
            {cancelError && <p className="text-xs font-medium text-red-600">{cancelError}</p>}
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-white shadow-sm transition-shadow duration-200 sm:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin className="h-4 w-4 text-blue-600" />
              Delivery address
            </CardTitle>
          </CardHeader>
          <CardContent className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-inner">
            {order.shippingFullName ? (
              <>
                <p className="font-medium text-gray-900">{order.shippingFullName}</p>
                {order.shippingPhone && <p className="mt-0.5">{order.shippingPhone}</p>}
                {order.shippingAddressLine1 && (
                  <p className="mt-2 leading-relaxed">
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
              <p className="text-gray-400">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {orderedItems.map((item) => {
              const deliveredIso = deliveredAtIso(item)
              const days = item.returnPolicyDays ?? 0
              let returnWindowText: string | null = null
              let daysLeft: number | null = null
              if (item.returnAvailable && days > 0 && deliveredIso) {
                const end = new Date(deliveredIso)
                end.setDate(end.getDate() + days)
                const ms = end.getTime() - Date.now()
                daysLeft = Math.ceil(ms / 86400000)
                returnWindowText = end.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              }

              return (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-100 sm:h-16 sm:w-16">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={itemName(item)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Package className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900">{itemName(item)}</p>
                      <Badge
                        variant="outline"
                        className={
                          item.returnAvailable
                            ? "border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800"
                            : "border-gray-200 text-[10px] font-semibold text-gray-600"
                        }
                      >
                        {returnLabel(item)}
                      </Badge>
                      {item.itemStatus === "REFUNDED" && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          Refunded
                        </span>
                      )}
                    </div>
                    {item.exchangeSourceOrderItemId && (
                      <p className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[11px] leading-relaxed text-indigo-950">
                        <span className="font-semibold">Exchange product</span> — track shipment below like any order.
                        Your original item&apos;s pickup is completed when this line is delivered.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-gray-200 text-[10px] font-medium uppercase tracking-wide text-gray-700">
                        {item.itemStatus.replace(/_/g, " ")}
                      </Badge>
                      <Button variant="outline" size="sm" asChild className="h-6 text-[10px] px-2 rounded-lg border-blue-200 bg-blue-50 text-blue-700 font-bold uppercase tracking-tighter">
                        <Link href={`/customer/orders/${order.id}/invoice?sellerId=${item.sellerId}`} target="_blank">
                          Invoice
                        </Link>
                      </Button>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Store className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {item.sellerStoreName ?? "Store"}
                      </span>
                    </div>
                    {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                      <p className="text-muted-foreground text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                      <span>
                        Qty <span className="font-medium text-gray-900">{item.quantity}</span>
                      </span>
                      <span>
                        Price <span className="font-medium text-gray-900">{formatCurrency(item.price)}</span>
                      </span>
                      {item.hasGst && (
                        <span className="text-emerald-700">
                          GST <span className="font-medium">{formatCurrency(item.gstAmount)}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold text-gray-900">
                      Line total: {formatCurrency(lineTotal(item))}
                    </p>
                    {item.itemStatus === "REFUNDED" && (
                      <p className="text-sm font-medium text-emerald-700">
                        Refund amount (line): {formatCurrency(lineTotal(item))}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Shipping: {formatCurrency(item.shippingAmount)}
                    </p>
                    {item.statusHistory.length > 0 && (
                      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tracking timeline</p>
                        <ul className="relative space-y-0 border-l-2 border-gray-200 pl-4">
                          {item.statusHistory.map((h, idx) => {
                            const isPast = idx < item.statusHistory.length - 1
                            return (
                              <li key={`${item.id}-hist-${idx}`} className="relative pb-4 last:pb-0">
                                <span className="absolute -left-[calc(0.5rem+5px)] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
                                  <CheckCircle2
                                    className={`h-4 w-4 ${isPast ? "text-green-600" : "text-blue-600"}`}
                                    aria-hidden
                                  />
                                </span>
                                <div className="min-w-0 pl-8 sm:pl-9">
                                  <p className={`text-xs font-bold ${isPast ? "text-green-700" : "text-blue-600"}`}>
                                    {String(h.status).replace(/_/g, " ")}
                                  </p>
                                  {h.location ? <p className="text-[11px] text-gray-600">{h.location}</p> : null}
                                  {h.note ? <p className="text-[11px] text-gray-600">{h.note}</p> : null}
                                  <span className="text-[10px] text-gray-500">
                                    {new Date(h.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                    {item.returnAvailable && !item.exchangeSourceOrderItemId && (
                      <div className="mt-3 w-full min-w-0">
                        <CustomerReturnExchangeStatusDashboard
                          compact
                          sectionId={`return-section-${item.id}`}
                          item={item}
                          replacementLine={
                            item.replacementOrderItemId
                              ? (order.items.find((l) => l.id === item.replacementOrderItemId) ?? null)
                              : null
                          }
                          returnWindowText={returnWindowText}
                          daysLeft={daysLeft}
                          formatCurrency={formatCurrency}
                          lineTotal={lineTotal(item)}
                          onRequestRefund={() => openRefundDialog(item.id)}
                          onRequestExchange={() => void openExchangeDialog(item.id)}
                          returnLoadingItemId={returnLoadingItemId}
                          exchangeOptionsLoading={exchangeOptionsLoading}
                          exchangeItemId={exchangeItemId}
                          requestRefundLabel="Request refund"
                          requestExchangeLabel="Exchange item"
                        />
                      </div>
                    )}
                    <CustomerOrderReviewSection
                      className="mt-3"
                      item={item}
                      getDraft={getDraft}
                      patchDraft={patchDraft}
                      editingReview={editingReview}
                      setEditingReview={setEditingReview}
                      submitReview={submitReview}
                      isObjectUrl={isObjectUrl}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
      {returnError && <p className="text-xs font-medium text-red-600">{returnError}</p>}

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Banknote className="h-4 w-4 text-blue-600" />
            Price breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Subtotal ({order.items.length} item(s))</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displaySubtotal : order.subtotal)}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Total GST</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displayTax : order.tax)}
            </span>
          </div>

          <div className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Order lines</p>
            {order.items.map((item) => {
              const gst = item.hasGst ? item.gstAmount : 0
              const totalInclGst = item.subtotalInclGst ?? item.subtotal + gst
              const isExchangeReplacement = !!item.exchangeSourceOrderItemId
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-1 border-b border-gray-100 pb-2 text-xs last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-gray-800">
                      {item.productNameSnapshot || item.serviceNameSnapshot || "Item"}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-gray-600">
                      ×{item.quantity}
                    </Badge>
                    {isExchangeReplacement && (
                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] text-indigo-800">
                        Exchange product
                      </Badge>
                    )}
                  </div>
                  <div className="text-right sm:pl-4">
                    <span className="text-gray-500">
                      {formatCurrency(item.subtotal)} {gst > 0 ? `+ GST ${formatCurrency(gst)}` : "+ No GST"}
                    </span>
                    <span className="block text-sm font-bold text-gray-900">{formatCurrency(totalInclGst)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {priceBreakdown.kind === "exchange" && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              <p className="font-semibold">Exchange (simple view)</p>
              <p className="mt-1 text-amber-900/90">
                Totals below are your original order + any top-up or wallet credit — not the sum of both line prices.
              </p>
            </div>
          )}
          {priceBreakdown.kind === "exchange" && priceBreakdown.topUp > 0.01 && (
            <div
              className={cn(
                "flex justify-between",
                priceBreakdown.topUpStatus === "COMPLETED" ? "text-emerald-800" : "text-amber-900",
              )}
            >
              <span>
                {priceBreakdown.topUpStatus === "COMPLETED"
                  ? "Exchange top-up (paid)"
                  : "Exchange top-up (extra to pay)"}
              </span>
              <span className="font-semibold">{formatCurrency(priceBreakdown.topUp)}</span>
            </div>
          )}
          {priceBreakdown.kind === "exchange" && priceBreakdown.walletCredit > 0.01 && (
            <div className="flex justify-between text-sky-900">
              <span>Wallet credit (cheaper exchange)</span>
              <span className="font-semibold">{formatCurrency(priceBreakdown.walletCredit)}</span>
            </div>
          )}

          {order.shipping > 0 && (
            <div className="flex justify-between pt-1">
              <span className="text-gray-500">Shipping</span>
              <span className="font-medium text-gray-900">{formatCurrency(order.shipping)}</span>
            </div>
          )}
          <Separator className="my-3 bg-gray-200" />
          <div className="flex justify-between text-lg font-bold text-gray-900">
            <span>Grand total</span>
            <span>
              {formatCurrency(
                priceBreakdown.kind === "exchange" ? priceBreakdown.effectiveGrandTotal : order.totalAmount,
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {order.sellerGroups.length > 0 && (
        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-900">Seller-wise breakup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {order.sellerGroups.map((group) => (
              <div
                key={group.sellerId ?? `group-${group.sellerStoreName ?? "unknown"}`}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{group.sellerStoreName ?? "Store"}</p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {group.derivedStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
                  <p>Items: {group.itemCount}</p>
                  <p>
                    Subtotal:{" "}
                    {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displaySubtotal : group.summary.subtotal)}
                  </p>
                  <p>
                    Tax:{" "}
                    {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displayTax : group.summary.tax)}
                  </p>
                  <p>Shipping: {formatCurrency(group.summary.shipping)}</p>
                  <p className="font-medium text-foreground">
                    Total:{" "}
                    {formatCurrency(
                      priceBreakdown.kind === "exchange" ? priceBreakdown.effectiveGrandTotal : group.summary.total,
                    )}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-gray-200 p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Request a refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-relaxed text-gray-600">
              Tell us why you&apos;re returning this item and add at least one clear photo (product, packaging, or issue).
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Reason</Label>
              <Textarea
                className="min-h-[100px] rounded-lg border-gray-300 p-3 text-sm text-gray-900 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                value={returnReasonDraft}
                onChange={(e) => setReturnReasonDraft(e.target.value)}
                placeholder={`Describe the issue (at least ${MIN_RETURN_REASON_LENGTH} characters)`}
              />
              <p className="text-[10px] text-muted-foreground">
                {returnReasonLen}/{MIN_RETURN_REASON_LENGTH}+ characters
                {returnReasonLen < MIN_RETURN_REASON_LENGTH && (
                  <span className="ml-1 font-medium text-amber-700">
                    — add {MIN_RETURN_REASON_LENGTH - returnReasonLen} more to continue
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Photos ({returnPhotos.files.length}/{MAX_RETURN_IMAGES}) — select multiple; uploaded to S3 when you submit (max{" "}
                5 MB each).
              </Label>
              <div className="flex flex-wrap gap-2">
                {returnPhotos.previews.map((url, idx) => (
                  <div
                    key={`${returnPhotos.files[idx]?.name ?? "f"}-${returnPhotos.files[idx]?.size ?? idx}-${idx}`}
                    className="relative h-16 w-16 overflow-hidden rounded border bg-muted"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white"
                      onClick={() => removeReturnPhotoAt(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-xs text-gray-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/30">
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="font-medium text-gray-700">Tap to add photos</span>
                <span className="text-[11px] text-gray-500">JPEG, PNG, WebP or GIF — up to {MAX_RETURN_IMAGES} images</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={
                    returnUploading ||
                    returnLoadingItemId === refundDialogItemId ||
                    returnPhotos.files.length >= MAX_RETURN_IMAGES
                  }
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || [])
                    e.target.value = ""
                    if (picked.length === 0) return
                    setReturnError(null)
                    addReturnPhotos(picked)
                  }}
                />
              </label>
            </div>
            {refundConfirmDisabled &&
              !returnUploading &&
              returnLoadingItemId !== refundDialogItemId && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Complete these to submit: </span>
                  {returnReasonLen < MIN_RETURN_REASON_LENGTH &&
                    `Reason needs at least ${MIN_RETURN_REASON_LENGTH} characters (${returnReasonLen}/${MIN_RETURN_REASON_LENGTH}). `}
                  {returnPhotos.files.length < MIN_RETURN_IMAGES &&
                    `Add at least ${MIN_RETURN_IMAGES} photo(s). `}
                </p>
              )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              className="rounded-lg border-gray-300 transition-all duration-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={refundConfirmDisabled}
              title={
                refundConfirmDisabled
                  ? "Add a 10+ character reason and at least one photo"
                  : undefined
              }
              className="rounded-lg bg-blue-600 font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
              onClick={() => void handleRefundSubmit()}
            >
              {returnUploading
                ? "Uploading photos…"
                : refundDialogItemId && returnLoadingItemId === refundDialogItemId
                  ? "Submitting…"
                  : "Submit return request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={exchangeOpen}
        onOpenChange={(open) => {
          setExchangeOpen(open)
          if (!open) {
            setExchangeProductName(null)
            setExchangeCurrentVariant(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-gray-200 p-6 shadow-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Exchange item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-relaxed text-gray-600">
              Pickup of your current item is recorded when the replacement is delivered (doorstep exchange).
            </p>
            {exchangeProductName && (
              <ExchangeCurrentVsReplacement
                productName={exchangeProductName}
                current={exchangeCurrentVariant}
                currentFallbackImage={exchangeLineItem?.imageUrl ?? null}
                replacement={selectedExchangeVariant}
              />
            )}
            <ExchangeVariantImageGrid
              variants={exchangeVariants}
              selectedId={selectedExchangeVariantId}
              onSelect={setSelectedExchangeVariantId}
              disabled={exchangeOptionsLoading}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Replacement variant</Label>
              <select
                className="flex h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={selectedExchangeVariantId}
                onChange={(e) => setSelectedExchangeVariantId(e.target.value)}
                aria-label="Select replacement variant"
              >
                {exchangeVariants.length === 0 ? (
                  <option value="">No other variants</option>
                ) : (
                  exchangeVariants.map((v) => (
                    <option key={v.id} value={v.id} disabled={!v.eligible}>
                      {v.name} — stock {v.stock}
                      {!v.eligible ? " (insufficient)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Why are you exchanging?</Label>
              <Textarea
                className="min-h-[100px] rounded-lg border-gray-300 p-3 text-sm text-gray-900 shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                value={returnReasonDraft}
                onChange={(e) => setReturnReasonDraft(e.target.value)}
                placeholder={`Describe the reason (at least ${MIN_RETURN_REASON_LENGTH} characters)`}
              />
              <p className="text-[10px] text-muted-foreground">
                {returnReasonLen}/{MIN_RETURN_REASON_LENGTH}+ characters
                {returnReasonLen < MIN_RETURN_REASON_LENGTH && (
                  <span className="ml-1 font-medium text-amber-700">
                    — add {MIN_RETURN_REASON_LENGTH - returnReasonLen} more to continue
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">
                Photos ({returnPhotos.files.length}/{MAX_RETURN_IMAGES}) — multiple select; S3 upload on submit (max 5 MB each).
              </Label>
              <div className="flex flex-wrap gap-2">
                {returnPhotos.previews.map((url, idx) => (
                  <div
                    key={`${returnPhotos.files[idx]?.name ?? "f"}-${returnPhotos.files[idx]?.size ?? idx}-${idx}`}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white"
                      onClick={() => removeReturnPhotoAt(idx)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-xs text-gray-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/30">
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="font-medium text-gray-700">Tap to add photos</span>
                <span className="text-[11px] text-gray-500">JPEG, PNG, WebP or GIF</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={
                    returnUploading ||
                    returnLoadingItemId === exchangeItemId ||
                    returnPhotos.files.length >= MAX_RETURN_IMAGES
                  }
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || [])
                    e.target.value = ""
                    if (picked.length === 0) return
                    setReturnError(null)
                    addReturnPhotos(picked)
                  }}
                />
              </label>
            </div>
            {(() => {
              const sel = exchangeVariants.find((v) => v.id === selectedExchangeVariantId)
              if (!sel?.eligible) return null
              if (sel.priceDifferenceTopUp > 0) {
                return (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Extra payment (incl. GST): <strong>{formatCurrency(sel.priceDifferenceTopUp)}</strong> — pay before the replacement ships (e.g. COD to seller).
                  </p>
                )
              }
              if (sel.priceDifferenceWalletCredit > 0) {
                const w = sel.priceDifferenceWalletCredit
                return (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Wallet credit for lower price: <strong>{formatCurrency(w)}</strong> — added to your balance when the replacement is delivered.
                  </p>
                )
              }
              return (
                <p className="text-xs text-gray-500">No price difference for this variant (same total incl. GST).</p>
              )
            })()}
            {exchangeConfirmDisabled &&
              !returnUploading &&
              returnLoadingItemId !== exchangeItemId && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Complete these to confirm: </span>
                  {(!selectedExchangeVariantId || !exchangeSelVariant) && "Choose a replacement variant. "}
                  {exchangeSelVariant && !exchangeSelVariant.eligible && "Pick a variant with enough stock. "}
                  {returnReasonLen < MIN_RETURN_REASON_LENGTH &&
                    `Reason needs at least ${MIN_RETURN_REASON_LENGTH} characters (${returnReasonLen}/${MIN_RETURN_REASON_LENGTH}). `}
                  {returnPhotos.files.length < MIN_RETURN_IMAGES &&
                    `Add at least ${MIN_RETURN_IMAGES} photo(s). `}
                </p>
              )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExchangeOpen(false)}
              className="rounded-lg border-gray-300 transition-all duration-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={exchangeConfirmDisabled}
              title={
                exchangeConfirmDisabled
                  ? "Fill reason (10+ chars), add photo(s), and choose an eligible variant"
                  : undefined
              }
              className="rounded-lg bg-blue-600 font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
              onClick={() => void handleExchangeSubmit()}
            >
              {returnUploading
                ? "Uploading photos…"
                : returnLoadingItemId === exchangeItemId
                  ? "Submitting…"
                  : "Confirm exchange"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
