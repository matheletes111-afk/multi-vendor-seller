"use client"

import Link from "next/link"
import { useState } from "react"
import { ShoppingBag, Eye, Star } from "lucide-react"
import { AddToCartButton } from "@/components/product/AddToCartButton"
import { WishlistButton } from "@/components/product/WishlistButton"
import { Button } from "@/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"

export type BrowseProduct = {
  id: string
  name: string
  description: string | null
  basePrice: number
  discount: number
  finalPrice: number
  images: string[] | unknown
  category: { name: string }
  seller: { store: { name: string } | null } | null
  _count: { reviews: number }
  avgRating: number
  soldCount: number
  discountPercent: number
  stock: number
  isBrandedSeller: boolean
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)))
  const h = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            h,
            "shrink-0",
            i < full ? "fill-[#fbbf24] text-[#fbbf24]" : "fill-gray-200 text-gray-200"
          )}
          strokeWidth={0.5}
        />
      ))}
    </span>
  )
}

export function BrowseProductCard({
  product,
  canUseWishlist,
  showFreeDelivery,
}: {
  product: BrowseProduct
  canUseWishlist: boolean
  showFreeDelivery: boolean
}) {
  const [quickOpen, setQuickOpen] = useState(false)
  const imageUrls = Array.isArray(product.images)
    ? product.images
    : typeof product.images === "string"
      ? (() => {
          try {
            return JSON.parse(product.images) as string[]
          } catch {
            return []
          }
        })()
      : []
  const firstImage = imageUrls.length > 0 ? imageUrls[0] : null
  const finalPrice = product.finalPrice ?? Math.max(0, (product.basePrice ?? 0) - (product.discount ?? 0))
  const hasDiscount = (product.discount ?? 0) > 0 && product.basePrice > 0

  return (
    <>
      <div className="group relative flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
        <Link href={`/product/${product.id}`} className="flex min-h-0 flex-1 flex-col">
          <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
            {canUseWishlist && (
              <div className="absolute right-2 top-2 z-10">
                <WishlistButton productId={product.id} />
              </div>
            )}
            <button
              type="button"
              className="absolute left-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 opacity-0 shadow transition hover:bg-white hover:text-amber-600 group-hover:opacity-100"
              title="Quick view"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setQuickOpen(true)
              }}
            >
              <Eye className="h-4 w-4" />
            </button>
            {firstImage ? (
              <img src={firstImage} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-12 w-12 text-slate-300" />
              </div>
            )}
            {hasDiscount && (
              <span className="absolute bottom-2 left-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                {product.discountPercent}% off
              </span>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <p className="line-clamp-2 text-sm font-medium text-gray-800">{product.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold text-slate-900">{formatCurrency(finalPrice)}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through">{formatCurrency(product.basePrice)}</span>
              )}
            </div>
            {product._count.reviews > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-600">
                <Stars rating={product.avgRating} />
                <span>
                  ({product._count.reviews})
                </span>
              </div>
            )}
            {product.soldCount > 0 && (
              <p className="mt-1 text-xs text-gray-500">{product.soldCount} sold</p>
            )}
            {showFreeDelivery && (
              <p className="mt-1 text-xs font-medium text-green-700">FREE delivery</p>
            )}
            {product.stock <= 0 && (
              <p className="mt-1 text-xs font-medium text-amber-700">Out of stock</p>
            )}
            <p className="mt-1 truncate text-xs text-gray-500">{product.seller?.store?.name ?? "Store"}</p>
          </div>
        </Link>
        <div className="mt-auto border-t border-slate-100 p-3 pt-2">
          <AddToCartButton
            productId={product.id}
            name={product.name}
            price={finalPrice}
            image={firstImage}
            size="sm"
            label="Add to Cart"
            showLabel={true}
            ariaLabel={`Add ${product.name} to cart`}
            className="w-full justify-center rounded-lg px-4 py-2"
          />
        </div>
      </div>

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="line-clamp-2 text-left">{product.name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-slate-50">
              {firstImage ? (
                <img src={firstImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="m-auto h-10 w-10 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xl font-bold">{formatCurrency(finalPrice)}</p>
              {product._count.reviews > 0 && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Stars rating={product.avgRating} size="md" />
                  <span>{product.avgRating.toFixed(1)} · {product._count.reviews} ratings</span>
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/product/${product.id}`}>View full details</Link>
              </Button>
              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={finalPrice}
                image={firstImage}
                size="sm"
                label="Add to Cart"
                showLabel={true}
                className="w-full justify-center"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { Stars }
