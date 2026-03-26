"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { Star, Upload, Loader2 } from "lucide-react"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"

export type CustomerReviewDraft = {
  rating: number
  comment: string
  files: File[]
  previewUrls: string[]
  submitting: boolean
  error: string | null
}

export type CustomerOrderReviewSectionProps = {
  item: OrderDetailApi["items"][number]
  getDraft: (itemId: string) => CustomerReviewDraft
  patchDraft: (itemId: string, patch: Partial<CustomerReviewDraft>) => void
  editingReview: Record<string, boolean>
  setEditingReview: Dispatch<SetStateAction<Record<string, boolean>>>
  submitReview: (item: OrderDetailApi["items"][number], method?: "POST" | "PATCH") => Promise<void>
  isObjectUrl: (url: string) => boolean
  /** Optional class for outer card wrapper */
  className?: string
}

export function CustomerOrderReviewSection({
  item,
  getDraft,
  patchDraft,
  editingReview,
  setEditingReview,
  submitReview,
  isObjectUrl,
  className = "",
}: CustomerOrderReviewSectionProps) {
  const commentMax = 2000
  const draft = getDraft(item.id)
  const commentLen = draft.comment.length

  if (item.review) {
    if (editingReview[item.id]) {
      return (
        <div
          className={`rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Rate &amp; Review This Product</h3>
              <p className="text-sm text-gray-500">Edit your review</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-shrink-0 rounded-lg px-4 py-2"
              onClick={() => {
                const d = getDraft(item.id)
                try {
                  for (const url of d.previewUrls) {
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
          <div className="mt-4 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => patchDraft(item.id, { rating: idx + 1 })}
                className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={`Rate ${idx + 1} star`}
              >
                <Star
                  className={`h-7 w-7 ${
                    idx < getDraft(item.id).rating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-medium text-gray-700">Write your experience</label>
          <Textarea
            className="mt-1 min-h-28 rounded-lg border-gray-300 text-sm text-gray-800 shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={getDraft(item.id).comment}
            onChange={(e) => patchDraft(item.id, { comment: e.target.value })}
            placeholder="Share details about the product quality, delivery experience, etc."
            maxLength={commentMax}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {commentLen} / {commentMax}
          </p>
          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              Upload up to 5 images
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []).slice(0, 5)
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
                  e.target.value = ""
                }}
              />
            </label>
            {getDraft(item.id).previewUrls.length > 0 ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {getDraft(item.id).previewUrls.length} image
                  {getDraft(item.id).previewUrls.length === 1 ? "" : "s"} attached
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {getDraft(item.id).previewUrls.map((url, idx) => (
                    <div
                      key={`${item.id}-preview-${idx}`}
                      className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Selected review image ${idx + 1}`} className="h-20 w-full object-cover" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const d = getDraft(item.id)
                          const nextPreviewUrls = d.previewUrls.filter((_, i) => i !== idx)
                          const removedPreviewUrl = d.previewUrls[idx]
                          let nextFiles = d.files
                          if (removedPreviewUrl && isObjectUrl(removedPreviewUrl)) {
                            const blobIndex = d.previewUrls.slice(0, idx).filter((u) => isObjectUrl(u)).length
                            nextFiles = d.files.filter((_, i) => i !== blobIndex)
                            try {
                              URL.revokeObjectURL(removedPreviewUrl)
                            } catch {
                              /* ignore */
                            }
                          }
                          patchDraft(item.id, { files: nextFiles, previewUrls: nextPreviewUrls })
                        }}
                        className="absolute right-1 top-1 h-7 w-7 rounded-full bg-white/90 p-0 text-slate-700 hover:bg-white"
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
            <p className="mt-2 text-sm font-medium text-red-600">{getDraft(item.id).error}</p>
          )}
          <div className="mt-4">
            <Button
              size="lg"
              className="rounded-lg px-6 py-2 font-semibold"
              onClick={() => submitReview(item, "PATCH")}
              disabled={getDraft(item.id).submitting}
            >
              {getDraft(item.id).submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update review"
              )}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div
        className={`rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
      >
        <h3 className="text-lg font-semibold text-gray-900">Rate &amp; Review This Product</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-900/80">Your review</p>
        <div className="mt-2 flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: 5 }).map((_, idx) => (
            <span
              key={idx}
              className={`text-xl leading-none ${idx < item.review!.rating ? "text-amber-500" : "text-gray-200"}`}
            >
              ★
            </span>
          ))}
        </div>
        {item.review.comment && (
          <p className="mt-2 text-sm italic leading-relaxed text-gray-700">{item.review.comment}</p>
        )}
        {item.review.images.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {item.review.images.map((url, idx) => (
              <a key={`${item.review!.id}-${idx}`} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Review ${idx + 1}`} className="h-16 w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
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
            className="rounded-lg px-6 py-2 font-medium text-primary underline-offset-2 hover:underline"
          >
            Edit review
          </Button>
        </div>
      </div>
    )
  }

  if (item.canReview) {
    return (
      <div
        className={`rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
      >
        <h3 className="text-lg font-semibold text-gray-900">Rate &amp; Review This Product</h3>
        <p className="mt-1 text-sm text-gray-600">Share your experience</p>
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => patchDraft(item.id, { rating: idx + 1 })}
              className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={`Rate ${idx + 1} star`}
            >
              <Star
                className={`h-7 w-7 ${
                  idx < getDraft(item.id).rating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                }`}
              />
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm font-medium text-gray-700">Write your experience</label>
        <Textarea
          className="mt-1 min-h-28 rounded-lg border-gray-300 text-sm text-gray-800 shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
          value={getDraft(item.id).comment}
          onChange={(e) => patchDraft(item.id, { comment: e.target.value })}
          placeholder="Share details about the product quality, delivery experience, etc."
          maxLength={commentMax}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {commentLen} / {commentMax}
        </p>
        <div className="mt-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Upload className="h-4 w-4" />
            Upload up to 5 images
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []).slice(0, 5)
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
                e.target.value = ""
              }}
            />
          </label>
          {getDraft(item.id).previewUrls.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {getDraft(item.id).previewUrls.length} image{getDraft(item.id).previewUrls.length === 1 ? "" : "s"}{" "}
                attached
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {getDraft(item.id).previewUrls.map((url, idx) => (
                  <div
                    key={`${item.id}-preview-${idx}`}
                    className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Selected review image ${idx + 1}`} className="h-20 w-full object-cover" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const d = getDraft(item.id)
                        const nextPreviewUrls = d.previewUrls.filter((_, i) => i !== idx)
                        const removedPreviewUrl = d.previewUrls[idx]
                        let nextFiles = d.files
                        if (removedPreviewUrl && isObjectUrl(removedPreviewUrl)) {
                          const blobIndex = d.previewUrls.slice(0, idx).filter((u) => isObjectUrl(u)).length
                          nextFiles = d.files.filter((_, i) => i !== blobIndex)
                          try {
                            URL.revokeObjectURL(removedPreviewUrl)
                          } catch {
                            /* ignore */
                          }
                        }
                        patchDraft(item.id, { files: nextFiles, previewUrls: nextPreviewUrls })
                      }}
                      className="absolute right-1 top-1 h-7 w-7 rounded-full bg-white/90 p-0 text-slate-700 hover:bg-white"
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
          <p className="mt-2 text-sm font-medium text-red-600">{getDraft(item.id).error}</p>
        )}
        <div className="mt-4">
          <Button
            size="lg"
            className="rounded-lg px-6 py-2 font-semibold"
            onClick={() => submitReview(item)}
            disabled={getDraft(item.id).submitting}
          >
            {getDraft(item.id).submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit review"
            )}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
