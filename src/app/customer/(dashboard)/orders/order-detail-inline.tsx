"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { formatCurrency, formatDate, formatSlotTimeRange } from "@/lib/utils"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { Package, MapPin, Banknote, Receipt, ShoppingBag, Minus, Star, Upload, Loader2 } from "lucide-react"

export function OrderDetailInline({
  order,
  onClose,
  onReviewSaved,
}: {
  order: OrderDetailApi
  onClose: () => void
  onReviewSaved?: (orderId: string) => Promise<void> | void
}) {
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        rating: number
        comment: string
        files: File[]
        previewUrls: string[]
        submitting: boolean
        error: string | null
      }
    >
  >({})

  const [editingReview, setEditingReview] = useState<Record<string, boolean>>({})
  const isObjectUrl = (url: string) => url.startsWith("blob:")

  const itemName = (item: OrderDetailApi["items"][number]) =>
    item.productNameSnapshot || item.serviceNameSnapshot || "Item"
  const lineTotal = (item: OrderDetailApi["items"][number]) =>
    item.subtotalInclGst ?? item.subtotal + item.gstAmount

  const getDraft = (itemId: string) =>
    drafts[itemId] ?? { rating: 0, comment: "", files: [], previewUrls: [], submitting: false, error: null }
  const patchDraft = (
    itemId: string,
    patch: Partial<{
      rating: number
      comment: string
      files: File[]
      previewUrls: string[]
      submitting: boolean
      error: string | null
    }>
  ) => {
    setDrafts((prev) => ({ ...prev, [itemId]: { ...getDraft(itemId), ...patch } }))
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

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground">
          Order #{order.orderNumber} • {formatDate(order.createdAt)}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details" className="shrink-0 -mr-2">
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize text-xs">
                {order.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{order.sellerStoreName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.paymentMethod ?? "—"} ({order.paymentStatus.toLowerCase()})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-lg border bg-background/50 p-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted sm:h-16 sm:w-16">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={itemName(item)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  <p className="font-medium">{itemName(item)}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {item.itemStatus.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.sellerStoreName ?? "Store"}</span>
                  </div>
                  {item.serviceNameSnapshot && item.serviceSlotStartTime && item.serviceSlotEndTime && (
                    <p className="text-muted-foreground text-xs">Slot: {formatSlotTimeRange(item.serviceSlotStartTime, item.serviceSlotEndTime)}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                    <span>Qty: {item.quantity}</span>
                    <span>× {formatCurrency(item.price)}</span>
                    {item.hasGst && <span className="text-emerald-600 dark:text-emerald-400">GST: {formatCurrency(item.gstAmount)}</span>}
                  </div>
                  <p className="font-semibold">Line total: {formatCurrency(lineTotal(item))}</p>
                  <p className="text-xs text-muted-foreground">
                    Shipping: {formatCurrency(item.shippingAmount)} • Commission: {formatCurrency(item.commissionAmount)}
                  </p>
                  {item.review ? (
                    editingReview[item.id] ? (
                      <div className="mt-2 rounded-md border bg-background p-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-medium text-muted-foreground">Edit your review</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              const draft = getDraft(item.id)
                              try {
                                for (const url of draft.previewUrls) {
                                  if (isObjectUrl(url)) URL.revokeObjectURL(url)
                                }
                              } catch {
                                /* ignore */
                              }
                              setEditingReview((prev) => ({ ...prev, [item.id]: false }))
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => patchDraft(item.id, { rating: idx + 1 })}
                              className="rounded p-0.5 hover:bg-muted"
                              aria-label={`Rate ${idx + 1} star`}
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  idx < getDraft(item.id).rating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          className="mt-2 min-h-20 text-xs"
                          value={getDraft(item.id).comment}
                          onChange={(e) => patchDraft(item.id, { comment: e.target.value })}
                          placeholder="Write your experience (optional)"
                          maxLength={2000}
                        />
                        <div className="mt-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <Upload className="h-3.5 w-3.5" />
                            Upload up to 5 images
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const selected = Array.from(e.target.files || []).slice(0, 5)
                                // Revoke old previews when replacing selection.
                                const oldDraft = getDraft(item.id)
                                try {
                                  for (const url of oldDraft.previewUrls) {
                                    if (isObjectUrl(url)) URL.revokeObjectURL(url)
                                  }
                                } catch {
                                  /* ignore */
                                }
                                const previewUrls = selected.map((f) => URL.createObjectURL(f))
                                patchDraft(item.id, { files: selected, previewUrls })
                                // Allow selecting the same file again.
                                e.target.value = ""
                              }}
                            />
                          </label>
                          {getDraft(item.id).previewUrls.length > 0 ? (
                            <div className="mt-2">
                              <p className="text-[11px] text-muted-foreground">
                                {getDraft(item.id).previewUrls.length} image
                                {getDraft(item.id).previewUrls.length === 1 ? "" : "s"} attached
                              </p>
                              <div className="mt-2 grid grid-cols-4 gap-2">
                                {getDraft(item.id).previewUrls.map((url, idx) => (
                                  <div key={`${item.id}-preview-${idx}`} className="relative overflow-hidden rounded border border-slate-200 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={`Selected review image ${idx + 1}`} className="h-20 w-full object-cover" />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const draft = getDraft(item.id)
                                        const nextPreviewUrls = draft.previewUrls.filter((_, i) => i !== idx)
                                        const removedPreviewUrl = draft.previewUrls[idx]
                                        let nextFiles = draft.files
                                        if (removedPreviewUrl && isObjectUrl(removedPreviewUrl)) {
                                          const blobIndex = draft.previewUrls
                                            .slice(0, idx)
                                            .filter((u) => isObjectUrl(u)).length
                                          nextFiles = draft.files.filter((_, i) => i !== blobIndex)
                                          try {
                                            URL.revokeObjectURL(removedPreviewUrl)
                                          } catch {
                                            /* ignore */
                                          }
                                        }
                                        patchDraft(item.id, { files: nextFiles, previewUrls: nextPreviewUrls })
                                      }}
                                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-white/90 p-0 text-slate-700 hover:bg-white"
                                      aria-label="Remove selected image"
                                    >
                                      <span className="text-sm leading-none">×</span>
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {getDraft(item.id).error && (
                          <p className="mt-2 text-xs font-medium text-red-600">{getDraft(item.id).error}</p>
                        )}
                        <div className="mt-2">
                          <Button
                            size="sm"
                            onClick={() => submitReview(item, "PATCH")}
                            disabled={getDraft(item.id).submitting}
                            className="h-8 text-xs"
                          >
                            {getDraft(item.id).submitting ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              "Update review"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-md border bg-muted/40 p-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Your review</p>
                        <div className="mt-1 flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-4 w-4 ${idx < item.review!.rating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                            />
                          ))}
                        </div>
                        {item.review.comment && <p className="mt-1 text-xs text-muted-foreground">{item.review.comment}</p>}
                        {item.review.images.length > 0 && (
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {item.review.images.map((url, idx) => (
                              <a key={`${item.review!.id}-${idx}`} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={`Review ${idx + 1}`} className="h-12 w-full rounded object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingReview((prev) => ({ ...prev, [item.id]: true }))
                              patchDraft(item.id, {
                                rating: item.review!.rating,
                                comment: item.review!.comment ?? "",
                                files: [],
                                previewUrls: item.review!.images,
                                submitting: false,
                                error: null,
                              })
                            }}
                            className="h-8 text-xs"
                          >
                            Edit review
                          </Button>
                        </div>
                      </div>
                    )
                  ) : item.canReview ? (
                    <div className="mt-2 rounded-md border bg-background p-2.5">
                      <p className="text-xs font-medium text-muted-foreground">Rate and review this item</p>
                      <div className="mt-1 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => patchDraft(item.id, { rating: idx + 1 })}
                            className="rounded p-0.5 hover:bg-muted"
                            aria-label={`Rate ${idx + 1} star`}
                          >
                            <Star
                              className={`h-4 w-4 ${
                                idx < getDraft(item.id).rating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        className="mt-2 min-h-20 text-xs"
                        value={getDraft(item.id).comment}
                        onChange={(e) => patchDraft(item.id, { comment: e.target.value })}
                        placeholder="Write your experience (optional)"
                        maxLength={2000}
                      />
                      <div className="mt-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                          <Upload className="h-3.5 w-3.5" />
                          Upload up to 5 images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const selected = Array.from(e.target.files || []).slice(0, 5)
                              // Revoke old previews when replacing selection.
                              const oldDraft = getDraft(item.id)
                              try {
                                for (const url of oldDraft.previewUrls) {
                                  if (isObjectUrl(url)) URL.revokeObjectURL(url)
                                }
                              } catch {
                                /* ignore */
                              }
                              const previewUrls = selected.map((f) => URL.createObjectURL(f))
                              patchDraft(item.id, { files: selected, previewUrls })
                              // Allow selecting the same file again.
                              e.target.value = ""
                            }}
                          />
                        </label>
                        {getDraft(item.id).previewUrls.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-[11px] text-muted-foreground">
                              {getDraft(item.id).previewUrls.length} image{getDraft(item.id).previewUrls.length === 1 ? "" : "s"} attached
                            </p>
                            {getDraft(item.id).previewUrls.length > 0 && (
                              <div className="mt-2 grid grid-cols-4 gap-2">
                                {getDraft(item.id).previewUrls.map((url, idx) => (
                                  <div key={`${item.id}-preview-${idx}`} className="relative overflow-hidden rounded border border-slate-200 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={`Selected review image ${idx + 1}`} className="h-20 w-full object-cover" />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const draft = getDraft(item.id)
                                        const nextPreviewUrls = draft.previewUrls.filter((_, i) => i !== idx)
                                        const removedPreviewUrl = draft.previewUrls[idx]
                                        let nextFiles = draft.files
                                        // Only remove from `files` if we removed a newly selected blob URL.
                                        if (removedPreviewUrl && isObjectUrl(removedPreviewUrl)) {
                                          const blobIndex = draft.previewUrls
                                            .slice(0, idx)
                                            .filter((u) => isObjectUrl(u)).length
                                          nextFiles = draft.files.filter((_, i) => i !== blobIndex)
                                          try {
                                            URL.revokeObjectURL(removedPreviewUrl)
                                          } catch {
                                            /* ignore */
                                          }
                                        }
                                        patchDraft(item.id, { files: nextFiles, previewUrls: nextPreviewUrls })
                                      }}
                                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-white/90 p-0 text-slate-700 hover:bg-white"
                                      aria-label="Remove selected image"
                                    >
                                      <span className="text-sm leading-none">×</span>
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {getDraft(item.id).error && (
                        <p className="mt-2 text-xs font-medium text-red-600">{getDraft(item.id).error}</p>
                      )}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={() => submitReview(item)}
                          disabled={getDraft(item.id).submitting}
                          className="h-8 text-xs"
                        >
                          {getDraft(item.id).submitting ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit review"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Price breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal ({order.items.length} item(s))</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatCurrency(order.shipping)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Grand total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {order.sellerGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Seller-wise breakup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {order.sellerGroups.map((group) => (
              <div key={group.sellerId ?? `group-${group.sellerStoreName ?? "unknown"}`} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{group.sellerStoreName ?? "Store"}</p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {group.derivedStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
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
    </div>
  )
}
