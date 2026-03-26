"use client"

import { Package } from "lucide-react"
import { cn } from "@/lib/utils"

export type ExchangeVariantOption = {
  id: string
  name: string
  eligible: boolean
  stock: number
  imageUrl?: string | null
  attributes?: unknown
  priceDifferenceTopUp: number
  priceDifferenceWalletCredit: number
}

export type ExchangeCurrentVariantInfo = {
  id: string
  name: string
  imageUrl: string | null
  attributes: unknown
}

function formatAttributes(attrs: unknown): string | null {
  if (!attrs || typeof attrs !== "object") return null
  const o = attrs as Record<string, unknown>
  const parts = Object.entries(o).filter(([, v]) => v != null && String(v).length > 0)
  if (parts.length === 0) return null
  return parts.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
}

function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:h-28 sm:w-28">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300">
          <Package className="h-12 w-12" aria-hidden />
        </div>
      )}
    </div>
  )
}

/** Side-by-side current order line vs selected replacement variant */
export function ExchangeCurrentVsReplacement({
  productName,
  current,
  currentFallbackImage,
  replacement,
}: {
  productName: string
  current: ExchangeCurrentVariantInfo | null
  currentFallbackImage: string | null
  replacement: ExchangeVariantOption | null
}) {
  const currentImg = current?.imageUrl ?? currentFallbackImage
  const currentAttr = formatAttributes(current?.attributes)
  const replAttr = replacement ? formatAttributes(replacement.attributes) : null

  return (
    <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current item</p>
        <div className="mt-3 flex gap-3">
          <ProductThumb src={currentImg} alt={productName} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-gray-900">{productName}</p>
            {current?.name && (
              <p className="mt-1 text-sm text-gray-700">
                Variant: <span className="font-medium">{current.name}</span>
              </p>
            )}
            {currentAttr && <p className="mt-1 text-xs text-gray-500">{currentAttr}</p>}
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Replacement</p>
        <div className="mt-3 flex gap-3">
          <ProductThumb
            src={replacement?.imageUrl ?? null}
            alt={replacement?.name ?? "Replacement"}
          />
          <div className="min-w-0 flex-1">
            {replacement ? (
              <>
                <p className="font-semibold leading-snug text-gray-900">{replacement.name}</p>
                <p className="mt-1 text-sm text-gray-600">
                  Stock: <span className="font-medium text-gray-900">{replacement.stock}</span>
                  {!replacement.eligible && (
                    <span className="ml-2 text-xs font-medium text-amber-700">Insufficient stock</span>
                  )}
                </p>
                {replAttr && <p className="mt-1 text-xs text-gray-500">{replAttr}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-500">Pick a variant below.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Visual grid of replacement variants; sync with hidden or visible select via onSelect */
export function ExchangeVariantImageGrid({
  variants,
  selectedId,
  onSelect,
  disabled,
}: {
  variants: ExchangeVariantOption[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  if (variants.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700">Choose replacement variant</p>
      <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {variants.map((v) => {
          const selected = v.id === selectedId
          return (
            <button
              key={v.id}
              type="button"
              disabled={disabled || !v.eligible}
              aria-pressed={selected}
              aria-label={`${v.name}, stock ${v.stock}`}
              onClick={() => onSelect(v.id)}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-all",
                selected ? "border-primary ring-2 ring-primary/20" : "border-gray-200 hover:border-gray-300",
                (!v.eligible || disabled) && "cursor-not-allowed opacity-50"
              )}
            >
              <div className="relative aspect-square w-full bg-gray-50">
                {v.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <Package className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 p-2">
                <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-900">{v.name}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">Stock {v.stock}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
