"use client"

import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { getCartItemId } from "@/lib/cart"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Trash2 } from "lucide-react"

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function CartClient() {
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCart()

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">
          Shopping Cart
          {items.length > 0 && (
            <span className="ml-1 sm:ml-2 text-base font-normal text-slate-600 sm:text-lg">
              ({totalItems} {totalItems === 1 ? "item" : "items"})
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-sm sm:mt-8 sm:p-12">
            <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 sm:h-16 sm:w-16" />
            <p className="mt-3 text-slate-600 sm:mt-4">Your cart is empty.</p>
            <Button asChild className="mt-4 w-full bg-amber-400 text-black hover:bg-amber-500 sm:w-auto">
              <Link href="/">Continue shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-6 lg:mt-6 lg:flex-row lg:items-start">
            {/* Cart items list - Amazon style */}
            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
              {items.map((item) => {
                const itemId = getCartItemId(item)
                const itemHref = item.productId ? `/product/${item.productId}` : `/service/${item.serviceId}`
                return (
                  <div
                    key={itemId}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:gap-4 sm:p-4"
                  >
                    <Link
                      href={itemHref}
                      className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:mx-0"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          No image
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <Link
                        href={itemHref}
                        className="font-medium text-slate-900 hover:text-blue-600 hover:underline line-clamp-2 text-sm sm:text-base"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatCurrency(item.price)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-3">
                        <label className="text-xs text-slate-600 sm:text-sm">
                          Qty:{" "}
                          <select
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(itemId, parseInt(e.target.value, 10))
                            }
                            className="ml-1 rounded border border-slate-300 bg-white py-0.5 pl-2 pr-6 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          >
                            {QUANTITY_OPTIONS.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="text-slate-400">|</span>
                        <button
                          type="button"
                          onClick={() => removeItem(itemId)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="shrink-0 text-center sm:text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotal box - Amazon style */}
            <div className="w-full shrink-0 lg:w-80">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <p className="text-base font-semibold text-slate-900 sm:text-lg">
                  Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"}):{" "}
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </p>
                <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                  Taxes and shipping calculated at checkout.
                </p>
                <Button asChild className="mt-4 w-full bg-amber-400 text-black hover:bg-amber-500" size="lg">
                  <Link href="/browse">Proceed to checkout</Link>
                </Button>
                <Button asChild variant="outline" className="mt-2 w-full" size="sm">
                  <Link href="/">Continue shopping</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
