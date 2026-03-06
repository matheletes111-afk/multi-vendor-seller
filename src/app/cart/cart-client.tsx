"use client"

import Link from "next/link"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"
import { useCart } from "@/app/cart/cart-context"
import { getCartItemId } from "@/app/cart/cart-types"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Trash2 } from "lucide-react"
import { UserRole } from "@prisma/client"

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function CartClient() {
  const { data: session, status } = useSession()
  const { items, totalItems, subtotal, updateQuantity, removeItem, isCartFromApi, isLoading } = useCart()

  const isCustomer = session?.user?.role === UserRole.CUSTOMER
  const checkoutHref = isCustomer ? "/checkout" : "/customer/login?callbackUrl=" + encodeURIComponent("/checkout")
  const isSellerOrAdmin = status === "authenticated" && !isCustomer

  if (isSellerOrAdmin) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:py-8 overflow-x-hidden">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl md:text-2xl lg:text-3xl">Shopping Cart</h1>
          <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm sm:mt-6 sm:p-8 md:mt-8 md:p-12">
            <ShoppingCart className="mx-auto h-10 w-10 text-slate-300 sm:h-12 sm:w-12 md:h-16 md:w-16" />
            <p className="mt-2 text-slate-700 text-sm font-medium sm:mt-3 sm:text-base md:mt-4">Cart is for customers only.</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              You are signed in as a seller or admin. Sign out to use a guest cart, or sign in with a customer account to add to cart and checkout.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:mt-6">
              <Button variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
              <Button asChild className="min-h-10 w-full bg-amber-400 text-black hover:bg-amber-500 sm:w-auto">
                <Link href="/customer/login?callbackUrl=/cart">Customer login</Link>
              </Button>
            </div>
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:py-8 overflow-x-hidden">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl md:text-2xl lg:text-3xl">
          Shopping Cart
          {items.length > 0 && (
            <span className="ml-1 text-sm font-normal text-slate-600 sm:ml-2 sm:text-base md:text-lg">
              ({totalItems} {totalItems === 1 ? "item" : "items"})
            </span>
          )}
        </h1>

        {items.length === 0 && !isLoading ? (
          <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm sm:mt-6 sm:p-8 md:mt-8 md:p-12">
            <ShoppingCart className="mx-auto h-10 w-10 text-slate-300 sm:h-12 sm:w-12 md:h-16 md:w-16" />
            <p className="mt-2 text-slate-600 text-sm sm:mt-3 sm:text-base">Your cart is empty.</p>
            <Button asChild className="mt-4 w-full min-h-11 bg-amber-400 text-black hover:bg-amber-500 sm:w-auto sm:min-h-0">
              <Link href="/">Continue shopping</Link>
            </Button>
          </div>
        ) : items.length === 0 && isLoading ? (
          <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm sm:mt-6 sm:p-8 md:mt-8 md:p-12">
            <p className="text-slate-600 text-sm sm:text-base">Loading cart…</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:gap-6 lg:flex-row lg:items-start">
            {/* Cart items list */}
            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
              {items.map((item) => {
                const itemId = getCartItemId(item)
                const itemHref = item.productId ? `/product/${item.productId}` : (item.serviceId ? `/service/${item.serviceId}` : "#")
                return (
                  <div
                    key={itemId}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:gap-4 sm:p-4"
                  >
                    <Link
                      href={itemHref}
                      className="relative mx-auto h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:mx-0 sm:h-24 sm:w-24"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain"
                          unoptimized
                          sizes="(max-width: 640px) 80px, 96px"
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
                        className="font-medium text-slate-900 hover:text-blue-600 hover:underline line-clamp-2 text-sm sm:text-base break-words"
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
                            className="min-h-9 rounded border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 touch-manipulation"
                          >
                            {QUANTITY_OPTIONS.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="hidden text-slate-400 sm:inline">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Do you want to remove "${item.name}" from the cart?`)) {
                              removeItem(itemId)
                            }
                          }}
                          className="flex min-h-9 min-w-[4.5rem] items-center justify-center gap-1 rounded-md text-sm text-blue-600 hover:bg-slate-100 hover:underline touch-manipulation sm:min-w-0 sm:justify-start"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
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

            {/* Subtotal box */}
            <div className="w-full shrink-0 lg:w-80">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
                <p className="text-sm font-semibold text-slate-900 sm:text-base md:text-lg">
                  Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"}):{" "}
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </p>
                <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                  Taxes and shipping calculated at checkout.
                </p>
                <Button asChild className="mt-4 w-full min-h-11 bg-amber-400 text-black hover:bg-amber-500 sm:min-h-12" size="lg">
                  <Link href={checkoutHref}>Proceed to checkout</Link>
                </Button>
                <Button asChild variant="outline" className="mt-2 w-full min-h-10 sm:min-h-9" size="sm">
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
