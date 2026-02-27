"use client"

import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/contexts/cart-context"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Trash2 } from "lucide-react"

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function CartClient() {
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCart()

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          Shopping Cart
          {items.length > 0 && (
            <span className="ml-2 text-lg font-normal text-slate-600">
              ({totalItems} {totalItems === 1 ? "item" : "items"})
            </span>
          )}
        </h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-xl bg-white p-12 text-center shadow-sm">
            <ShoppingCart className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-slate-600">Your cart is empty.</p>
            <Button asChild className="mt-4 bg-amber-400 text-black hover:bg-amber-500">
              <Link href="/">Continue shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Cart items list - Amazon style */}
            <div className="flex-1 space-y-4">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100"
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
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${item.productId}`}
                      className="font-medium text-slate-900 hover:text-blue-600 hover:underline line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatCurrency(item.price)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <label className="text-sm text-slate-600">
                        Qty:{" "}
                        <select
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.productId, parseInt(e.target.value, 10))
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
                        onClick={() => removeItem(item.productId)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal box - Amazon style */}
            <div className="shrink-0 lg:w-80">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold text-slate-900">
                  Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"}):{" "}
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Taxes and shipping calculated at checkout.
                </p>
                <Button asChild className="mt-4 w-full bg-amber-400 text-black hover:bg-amber-500" size="lg">
                  <Link href="/customer/browse">Proceed to checkout</Link>
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
