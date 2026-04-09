"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Skeleton } from "@/ui/skeleton"
import { cn, formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import {
  MAX_RETURN_IMAGES,
  MIN_RETURN_IMAGES,
  MIN_RETURN_REASON_LENGTH,
} from "@/lib/return-request-validation"
import {
  Package,
  MapPin,
  Banknote,
  ArrowLeft,
  Receipt,
  ShoppingBag,
  Upload,
  CheckCircle2,
  Store,
  Copy,
  Truck,
  ChevronRight,
  MessageCircle,
} from "lucide-react"
import { CustomerOrderReviewSection, type CustomerReviewDraft } from "../customer-order-review-section"
import { CustomerReturnExchangeStatusDashboard } from "../customer-return-exchange-status-dashboard"
import {
  ExchangeCurrentVsReplacement,
  ExchangeVariantImageGrid,
  type ExchangeCurrentVariantInfo,
  type ExchangeVariantOption,
} from "../exchange-modal-product-panels"
import { getExchangeOrderPriceBreakdown } from "@/lib/exchange-order-display"
import { flattenOrderItemsForCustomerDisplay } from "@/lib/customer-order-item-order"

function statusIconEmoji(status: string): string {
  const s = status.toUpperCase().replace(/\s+/g, "_")
  if (s.includes("PENDING")) return "🕐"
  if (s.includes("CONFIRM")) return "✓"
  if (s.includes("PROCESS")) return "⚙"
  if (s.includes("OUT_FOR") || s.includes("OUT FOR")) return "🚚"
  if (s.includes("SHIP")) return "📦"
  if (s.includes("DELIVER")) return "✅"
  if (s.includes("RETURN")) return "↩️"
  if (s.includes("REFUND")) return "💰"
  return "📋"
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toUpperCase()
  if (s.includes("DELIVER")) return "bg-green-100 text-green-800 border-green-200"
  if (s.includes("SHIP")) return "bg-blue-100 text-blue-800 border-blue-200"
  if (s.includes("CONFIRM") || s.includes("PROCESS")) return "bg-purple-100 text-purple-800 border-purple-200"
  if (s.includes("PENDING")) return "bg-amber-100 text-amber-800 border-amber-200"
  if (s.includes("CANCEL")) return "bg-red-100 text-red-800 border-red-200"
  return "bg-gray-100 text-gray-800 border-gray-200"
}

function returnEligibleBadgeClass(): string {
  return "bg-green-100 text-green-800 border-green-200"
}

function deliveredAtIso(item: OrderDetailApi["items"][number]): string | null {
  const hist = item.statusHistory
  for (let i = hist.length - 1; i >= 0; i--) {
    if (String(hist[i].status).toUpperCase().includes("DELIVER")) return hist[i].createdAt
  }
  return null
}

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const orderTrackingRef = useRef<HTMLDivElement | null>(null)
  const [order, setOrder] = useState<OrderDetailApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, CustomerReviewDraft>>({})
  const [editingReview, setEditingReview] = useState<Record<string, boolean>>({})
  const [returnLoadingItemId, setReturnLoadingItemId] = useState<string | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundDialogItemId, setRefundDialogItemId] = useState<string | null>(null)
  const [returnReasonDraft, setReturnReasonDraft] = useState("")
  /** Local files only; S3 upload runs on submit via /api/customer/review-upload (uploadPublicFile). */
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

  const fetchOrder = useCallback(async () => {
    setNotFound(false)
    const res = await fetch(`/api/customer/orders/${orderId}`, { credentials: "include" })
    if (res.status === 404) {
      setNotFound(true)
      return
    }
    if (!res.ok) return
    const data = (await res.json()) as OrderDetailApi
    setOrder(data)
  }, [orderId])

  useEffect(() => {
    fetchOrder().finally(() => setLoading(false))
  }, [fetchOrder])

  const emptyReviewDraft = (): CustomerReviewDraft => ({
    rating: 0,
    comment: "",
    files: [],
    previewUrls: [],
    submitting: false,
    error: null,
  })

  const getDraft = (itemId: string): CustomerReviewDraft => drafts[itemId] ?? emptyReviewDraft()

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

      const res = await fetch(`/api/customer/orders/${orderId}/items/${item.id}/review`, {
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

      try {
        for (const url of draft.previewUrls) {
          if (isObjectUrl(url)) URL.revokeObjectURL(url)
        }
      } catch {
        /* ignore */
      }
      patchDraft(item.id, {
        rating: 0,
        comment: "",
        files: [],
        previewUrls: [],
        submitting: false,
        error: null,
      })
      if (method === "PATCH") setEditingReview((prev) => ({ ...prev, [item.id]: false }))
      await fetchOrder()
    } catch (error) {
      patchDraft(item.id, {
        submitting: false,
        error: error instanceof Error ? error.message : "Failed to submit review",
      })
    }
  }

  /** Uploads one image to S3 through the customer review-upload API (return-images folder). */
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

  const resetReturnPhotos = useCallback(() => {
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
  }, [])

  const addReturnPhotos = useCallback((incoming: File[]) => {
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
  }, [])

  const removeReturnPhotoAt = useCallback((idx: number) => {
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
  }, [])

  const submitReturnRequest = (
    itemId: string,
    resolutionType: "REFUND" | "EXCHANGE",
    opts: { replacementVariantId?: string; reason: string; returnImages: string[] }
  ) => {
    setReturnError(null)
    setReturnLoadingItemId(itemId)
    fetch(`/api/customer/orders/${orderId}/items/${itemId}/return-request`, {
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
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? "Failed to request return")
        }
        setExchangeOpen(false)
        setExchangeItemId(null)
        setExchangeProductName(null)
        setExchangeCurrentVariant(null)
        setRefundDialogOpen(false)
        setRefundDialogItemId(null)
        setReturnReasonDraft("")
        resetReturnPhotos()
        return fetchOrder()
      })
      .catch((err: Error) => setReturnError(err.message))
      .finally(() => setReturnLoadingItemId(null))
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
      const res = await fetch(`/api/customer/orders/${orderId}/items/${itemId}/exchange-options`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        variants?: unknown
        productName?: string | null
        currentVariant?: ExchangeCurrentVariantInfo | null
      }
      if (!res.ok) throw new Error(json?.error ?? "Could not load exchange options")
      const variants = (json.variants ?? []) as ExchangeVariantOption[]
      const line = order?.items.find((i) => i.id === itemId)
      const fallbackName =
        line?.productNameSnapshot || line?.serviceNameSnapshot || "Item"
      setExchangeProductName(json.productName ?? fallbackName)
      setExchangeCurrentVariant(json.currentVariant ?? null)
      setExchangeItemId(itemId)
      setExchangeVariants(variants)
      const firstOk = variants.find((v) => v.eligible)
      setSelectedExchangeVariantId(firstOk?.id ?? "")
      setReturnReasonDraft("")
      resetReturnPhotos()
      setExchangeOpen(true)
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Failed to load variants")
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
    submitReturnRequest(refundDialogItemId, "REFUND", {
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
    submitReturnRequest(exchangeItemId, "EXCHANGE", {
      replacementVariantId: selectedExchangeVariantId,
      reason: returnReasonDraft,
      returnImages: urls,
    })
  }

  const canCancelOrder =
    !!order && order.items.length > 0 && order.items.every((item) => item.itemStatus === "PENDING")
  const handleCancelOrder = () => {
    if (!order || !canCancelOrder || cancelLoading) return
    setCancelError(null)
    setCancelLoading(true)
    fetch(`/api/customer/orders/${order.id}/cancel`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? "Failed to cancel order")
        }
        return fetchOrder()
      })
      .catch((err: Error) => setCancelError(err.message))
      .finally(() => setCancelLoading(false))
  }

  const copyOrderId = () => {
    if (!order) return
    const text = order.orderNumber || order.id
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    })
  }

  const scrollToTracking = () => {
    orderTrackingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

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


  const priceBreakdown = useMemo(
    () => (order ? getExchangeOrderPriceBreakdown(order) : ({ kind: "standard" } as const)),
    [order],
  )

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl p-4 sm:p-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="container mx-auto max-w-6xl p-6">
        <Card className="border-gray-200 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-gray-600">Order not found.</p>
            <Button asChild variant="outline" className="rounded-lg">
              <Link href="/customer/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const orderedItems = flattenOrderItemsForCustomerDisplay(order.items)
  const firstTrackingItemId = orderedItems.find((i) => i.statusHistory.length > 0)?.id ?? null
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

  return (
    <div className="container mx-auto max-w-6xl p-4 font-sans sm:p-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-600" aria-label="Breadcrumb">
        <Link href="/customer/orders" className="hover:text-primary">
          My Orders
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        <span className="font-medium text-gray-900">Order Details</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Order{" "}
              <span className="font-mono text-xl sm:text-2xl">#{order.orderNumber}</span>
            </h1>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border-gray-300"
              onClick={copyOrderId}
              title="Copy order ID"
              aria-label="Copy order ID"
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copiedId && <span className="text-sm text-green-600">Copied!</span>}
          </div>
          <p className="mt-2 text-gray-600">{formatDate(order.createdAt)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${orderStatusBadgeClass(order.status)}`}
            >
              {order.status.toLowerCase().replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button
            type="button"
            variant="default"
            className="rounded-lg px-6 py-2 shadow-md transition-shadow hover:shadow-lg"
            onClick={scrollToTracking}
          >
            <Truck className="mr-2 h-4 w-4" />
            Track order
          </Button>
          <Button variant="ghost" size="sm" asChild className="rounded-lg">
            <Link href="/customer/orders" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,65%)_minmax(0,35%)] lg:items-start">
        <div className="min-w-0 space-y-6">
          {orderedItems.map((item, itemIndex) => {
            const gallery = item.imageUrl ? [item.imageUrl] : []
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

            const isTrackAnchor = item.id === firstTrackingItemId && firstTrackingItemId != null

            return (
              <div key={item.id} className="space-y-6">
                <Card className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {item.exchangeSourceOrderItemId ? "Exchange product" : "Product information"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="flex shrink-0 flex-col gap-2 sm:w-[200px]">
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                          {gallery[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={gallery[0]}
                              alt={itemName(item)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                              <Package className="h-16 w-16" />
                            </div>
                          )}
                        </div>
                        {gallery.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {gallery.map((url, gi) => (
                              <div
                                key={`${item.id}-g-${gi}`}
                                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-primary ring-2 ring-primary/20"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <h2 className="text-xl font-bold text-gray-900">{itemName(item)}</h2>
                        {item.exchangeSourceOrderItemId && (
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950">
                            <p className="text-indigo-900/90">
                              This is your new item for an approved exchange. Track shipment in{" "}
                              <span className="font-medium">Order tracking</span> below — same steps as any order. Your
                              original item&apos;s return pickup is completed automatically when this delivery is marked
                              complete.
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-gray-200 text-xs uppercase">
                            {item.itemStatus.replace(/_/g, " ")}
                          </Badge>
                          {item.returnAvailable && (
                            <Badge
                              variant="outline"
                              className={`rounded-full border text-xs font-semibold ${returnEligibleBadgeClass()}`}
                            >
                              Return eligible
                              {daysLeft != null && daysLeft >= 0
                                ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`
                                : ""}
                            </Badge>
                          )}
                        </div>
                        {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                          <p className="text-sm text-gray-600">
                            Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <Store className="h-4 w-4 text-gray-400" aria-hidden />
                          <span className="font-medium text-gray-800">{item.sellerStoreName ?? "Store"}</span>
                          <Link
                            href="/customer/browse"
                            className="text-primary hover:underline"
                            title="Browse marketplace"
                          >
                            View store
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-sm">
                          <span className="text-gray-600">
                            Qty <span className="font-mono font-semibold text-gray-900">{item.quantity}</span>
                          </span>
                          <span className="text-gray-600">
                            Unit price{" "}
                            <span className="font-mono font-semibold text-gray-900">
                              {formatCurrency(item.price)}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 font-medium text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            {item.itemStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                        {item.deliveryProofImage && (
                          <a
                            href={item.deliveryProofImage}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
                          >
                            View delivery proof
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {item.statusHistory.length > 0 && (
                  <Card
                    ref={isTrackAnchor ? orderTrackingRef : undefined}
                    className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-lg font-semibold text-gray-900">Order tracking</CardTitle>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {item.itemStatus.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {item.itemStatus !== "DELIVERED" && (
                        <p className="text-sm text-gray-500">We&apos;ll update this as your package moves.</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="relative space-y-0 border-l-2 border-gray-200 pl-6">
                        {item.statusHistory.map((h, idx) => {
                          const isLast = idx === item.statusHistory.length - 1
                          const isComplete = !isLast
                          const emoji = statusIconEmoji(h.status)
                          return (
                            <li
                              key={`${item.id}-hist-${idx}`}
                              className={`relative pb-6 last:pb-0 ${
                                isLast ? "border-l-2 border-primary -ml-[2px]" : ""
                              }`}
                            >
                              <span
                                className={`absolute -left-[calc(0.75rem+5px)] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-sm shadow-sm ${
                                  isComplete
                                    ? "border-green-500 text-green-600"
                                    : isLast
                                      ? "border-blue-500 text-blue-600 ring-4 ring-blue-100"
                                      : "border-gray-200 text-gray-400"
                                }`}
                              >
                                <span aria-hidden>{emoji}</span>
                              </span>
                              {isLast && (
                                <span className="absolute -left-[11px] top-8 h-3 w-3 animate-pulse rounded-full bg-blue-500" />
                              )}
                              <div className="min-w-0 pl-10 sm:pl-11">
                                <p
                                  className={`text-sm font-semibold ${
                                    isComplete ? "text-green-800" : isLast ? "text-blue-700" : "text-gray-600"
                                  }`}
                                >
                                  {String(h.status).replace(/_/g, " ")}
                                </p>
                                {h.location ? (
                                  <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                                    {h.location}
                                  </p>
                                ) : null}
                                {h.note ? (
                                  <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
                                    <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                                    {h.note}
                                  </p>
                                ) : null}
                                <time className="mt-1 block text-xs text-gray-500">
                                  {new Date(h.createdAt).toLocaleString()}
                                </time>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {item.statusHistory.length > 6 && (
                        <p className="mt-2 text-center text-xs text-gray-500">Full timeline above</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {item.returnAvailable && !item.exchangeSourceOrderItemId && (
                  <CustomerReturnExchangeStatusDashboard
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
                  />
                )}

                <CustomerOrderReviewSection
                  item={item}
                  getDraft={getDraft}
                  patchDraft={patchDraft}
                  editingReview={editingReview}
                  setEditingReview={setEditingReview}
                  submitReview={submitReview}
                  isObjectUrl={isObjectUrl}
                />

                {itemIndex < orderedItems.length - 1 && <Separator className="bg-gray-200" />}
              </div>
            )
          })}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6">
          <Card className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Receipt className="h-5 w-5 text-primary" />
                Order summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                {order.items.map((item) => {
                  const gst = item.hasGst ? item.gstAmount : 0
                  const totalInclGst = item.subtotalInclGst ?? item.subtotal + gst
                  const isExchangeReplacement = !!item.exchangeSourceOrderItemId
                  return (
                    <div key={`sum-${item.id}`} className="flex justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <span className="min-w-0 truncate text-gray-600">
                        {itemName(item)} ×{item.quantity}
                        {isExchangeReplacement && (
                          <span className="ml-1.5 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800">
                            Exchange product
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono font-semibold text-gray-900">
                        {formatCurrency(totalInclGst)}
                      </span>
                    </div>
                  )
                })}
              </div>
              {priceBreakdown.kind === "exchange" && (
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                  <p className="font-semibold text-amber-950">Exchange (simple view)</p>
                  <p className="mt-1 text-amber-900/90">
                    Your original order total is below. The replacement line shows the new item value — we don&apos;t add
                    both as one bill. {priceBreakdown.topUp > 0.01 && (
                      <>
                        {priceBreakdown.topUpStatus === "COMPLETED"
                          ? `Recorded top-up (paid): ${formatCurrency(priceBreakdown.topUp)}. `
                          : `Extra to pay: ${formatCurrency(priceBreakdown.topUp)}. `}
                      </>
                    )}
                    {priceBreakdown.walletCredit > 0.01 && (
                      <>Wallet credit (cheaper replacement): {formatCurrency(priceBreakdown.walletCredit)}. </>
                    )}
                  </p>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displaySubtotal : order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax (GST)</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatCurrency(priceBreakdown.kind === "exchange" ? priceBreakdown.displayTax : order.tax)}
                </span>
              </div>
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
                      : "Exchange price difference (top-up)"}
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(priceBreakdown.topUp)}</span>
                </div>
              )}
              {priceBreakdown.kind === "exchange" && priceBreakdown.walletCredit > 0.01 && (
                <div className="flex justify-between text-sky-900">
                  <span>Wallet credit (cheaper exchange)</span>
                  <span className="font-mono font-semibold">{formatCurrency(priceBreakdown.walletCredit)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="font-mono font-medium text-gray-900">
                  {order.shipping <= 0 ? (
                    <span className="font-semibold text-green-600">FREE</span>
                  ) : (
                    formatCurrency(order.shipping)
                  )}
                </span>
              </div>
              <Separator className="bg-gray-200" />
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span className="font-mono">
                  {formatCurrency(
                    priceBreakdown.kind === "exchange" ? priceBreakdown.effectiveGrandTotal : order.totalAmount,
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3 text-gray-600">
                <span>Payment</span>
                <span className="text-right font-medium text-gray-900">
                  {order.paymentMethod ?? "—"}{" "}
                  <span className="text-gray-500">({order.paymentStatus.toLowerCase()})</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <span className="text-gray-600">Order ID</span>
                <div className="flex items-center gap-1">
                  <code className="max-w-[140px] truncate rounded bg-gray-100 px-2 py-1 text-xs">{order.orderNumber}</code>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={copyOrderId} aria-label="Copy order ID">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {canCancelOrder && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-lg"
                    onClick={handleCancelOrder}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? "Cancelling..." : "Cancel order"}
                  </Button>
                </div>
              )}
              {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <MapPin className="h-5 w-5 text-primary" />
                Delivery address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-gray-600">
              {order.shippingFullName ? (
                <>
                  <p className="font-semibold text-gray-900">{order.shippingFullName}</p>
                  {order.shippingPhone && <p className="mt-1">{order.shippingPhone}</p>}
                  {order.shippingAddressLine1 && (
                    <p className="mt-2">
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

          <Card className="border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Store className="h-5 w-5 text-primary" />
                Seller
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">{order.sellerStoreName ?? "—"}</p>
              <Button variant="outline" size="sm" className="w-full rounded-lg border-gray-300" asChild>
                <Link href="/customer/browse">Browse marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      {returnError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{returnError}</p>
      )}

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-gray-200 shadow-xl max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-h-[90vh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-t sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Tell us why you&apos;re returning this item and add at least one clear photo (product, packaging, or issue).
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Textarea
                className="min-h-[88px] rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-primary"
                value={returnReasonDraft}
                onChange={(e) => setReturnReasonDraft(e.target.value)}
                placeholder={`Describe the issue (at least ${MIN_RETURN_REASON_LENGTH} characters)`}
              />
              <p className="text-xs text-muted-foreground">
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
                Photos ({returnPhotos.files.length}/{MAX_RETURN_IMAGES}) — JPEG, PNG, WebP or GIF (max 5 MB each). Uploaded
                to secure storage when you submit.
              </Label>
              <div className="flex flex-wrap gap-2">
                {returnPhotos.previews.map((url, idx) => (
                  <div
                    key={`${returnPhotos.files[idx]?.name ?? "f"}-${returnPhotos.files[idx]?.size ?? idx}-${idx}`}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  Add photos
                </span>
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
              (refundDialogItemId ? returnLoadingItemId !== refundDialogItemId : true) && (
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
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={refundConfirmDisabled}
              title={
                refundConfirmDisabled
                  ? "Add a 10+ character reason and at least one photo"
                  : undefined
              }
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-gray-200 shadow-xl max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:max-h-[90vh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-t sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exchange item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
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
              <Label className="text-xs">Replacement variant</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-primary"
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
            <div className="space-y-1.5">
              <Label className="text-xs">Why are you exchanging?</Label>
              <Textarea
                className="min-h-[88px] rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-primary"
                value={returnReasonDraft}
                onChange={(e) => setReturnReasonDraft(e.target.value)}
                placeholder={`Describe the reason (at least ${MIN_RETURN_REASON_LENGTH} characters)`}
              />
              <p className="text-xs text-muted-foreground">
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
                Photos ({returnPhotos.files.length}/{MAX_RETURN_IMAGES}) — JPEG, PNG, WebP or GIF (max 5 MB each). Uploaded
                to secure storage when you submit.
              </Label>
              <div className="flex flex-wrap gap-2">
                {returnPhotos.previews.map((url, idx) => (
                  <div
                    key={`${returnPhotos.files[idx]?.name ?? "f"}-${returnPhotos.files[idx]?.size ?? idx}-${idx}`}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  Add photos
                </span>
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
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    Extra payment (incl. GST): <strong>{formatCurrency(sel.priceDifferenceTopUp)}</strong> — pay before the replacement ships.
                  </p>
                )
              }
              if (sel.priceDifferenceWalletCredit > 0) {
                const w = sel.priceDifferenceWalletCredit
                return (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
                    Wallet credit for lower price: <strong>{formatCurrency(w)}</strong> — added to your balance when the replacement is delivered.
                  </p>
                )
              }
              return <p className="text-xs text-muted-foreground">No price difference for this variant.</p>
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
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => setExchangeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={exchangeConfirmDisabled}
              title={
                exchangeConfirmDisabled
                  ? "Fill reason (10+ chars), add photo(s), and choose an eligible variant"
                  : undefined
              }
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
