"use client"


import Link from "next/link"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"
import { useCart } from "@/app/cart/cart-context"
import { getCartItemId } from "@/app/cart/cart-types"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react"
import { UserRole } from "@prisma/client"

export function CartClient() {
  const { data: session, status } = useSession()
  const { items, totalItems, subtotal, updateQuantity, removeItem } = useCart()

  const isCustomer = session?.user?.role === UserRole.CUSTOMER
  const checkoutHref = isCustomer ? "/checkout" : "/customer/login?callbackUrl=" + encodeURIComponent("/checkout")
  const isSellerOrAdmin = status === "authenticated" && !isCustomer

  if (isSellerOrAdmin) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:py-8 overflow-x-hidden">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl md:text-2xl lg:text-3xl">Shopping Cart</h1>
          <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm sm:mt-6 sm:p-8 md:mt-8 md:p-12 border border-slate-200">
            <ShoppingCart className="mx-auto h-10 w-10 text-slate-300 sm:h-12 sm:w-12 md:h-16 md:w-16" />
            <p className="mt-2 text-slate-700 text-sm font-medium sm:mt-3 sm:text-base md:mt-4">Cart is for customers only.</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              You are signed in as a seller or admin. Sign out to use a guest cart, or sign in with a customer account to add to cart and checkout.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:mt-6">
              <Button variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
              <Button asChild className="min-h-10 w-full bg-amber-400 text-black hover:bg-amber-500 sm:w-auto font-semibold">
                <Link href="/customer/login?callbackUrl=/cart">Customer login</Link>
              </Button>
            </div>
          </div>
        </div>
      </PublicLayout>
    )
  }

  const productItems = items.filter((item) => item.productId)

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50/60 py-6 sm:py-10">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 md:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-4">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
                Shopping Cart
              </h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Review your items and proceed to checkout
              </p>
            </div>
            {productItems.length > 0 && (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold sm:text-sm">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </Badge>
            )}
          </div>

          {productItems.length === 0 ? (
            <div className="my-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12 md:p-16">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 mb-4 sm:h-20 sm:w-20">
                <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Your cart is empty</h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm max-w-md mx-auto">
                Looks like you haven't added anything to your cart yet. Explore our marketplace and discover great products!
              </p>
              <Button asChild className="mt-6 min-h-11 rounded-xl bg-amber-400 font-bold text-slate-900 hover:bg-amber-500 px-6 shadow-sm">
                <Link href="/browse">Start Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Items List */}
              <div className="min-w-0 flex-1 space-y-4">
                {productItems.map((item) => {
                  const itemId = getCartItemId(item)
                  const itemHref = `/product/${item.productId}`

                  // Available stock for item directly from cart state
                  const knownStock = item.stock ?? 999
                  const isMaxStockReached = item.quantity >= knownStock

                  return (
                    <div
                      key={itemId}
                      className="group relative flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:flex-row sm:items-center sm:gap-5"
                    >
                      {/* Product Image */}
                      <Link
                        href={itemHref}
                        className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 sm:mx-0 sm:h-28 sm:w-28"
                      >
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                            unoptimized
                            sizes="(max-width: 640px) 96px, 112px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No image
                          </div>
                        )}
                      </Link>

                      {/* Product Info & Controls */}
                      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                        <Link
                          href={itemHref}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-2 text-sm sm:text-base leading-snug"
                        >
                          {item.name}
                        </Link>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <p className="text-base font-extrabold text-slate-900">
                            {formatCurrency(item.price)}
                          </p>

                          {/* Stock Status Badge */}
                          {knownStock <= 5 && knownStock > 0 ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800">
                              Only {knownStock} left
                            </Badge>
                          ) : knownStock > 5 && knownStock < 999 ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-800">
                              In Stock
                            </Badge>
                          ) : null}
                        </div>

                        {/* Quantity Stepper & Actions */}
                        <div className="pt-1 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                          {/* Plus/Minus Stepper Button */}
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 shadow-inner">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  updateQuantity(itemId, item.quantity - 1)
                                } else {
                                  if (window.confirm(`Do you want to remove "${item.name}" from your cart?`)) {
                                    removeItem(itemId)
                                  }
                                }
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>

                            <span className="w-10 text-center text-sm font-extrabold text-slate-900">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (!isMaxStockReached) {
                                  updateQuantity(itemId, item.quantity + 1)
                                }
                              }}
                              disabled={isMaxStockReached}
                              title={isMaxStockReached ? `Maximum available stock is ${knownStock}` : undefined}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Do you want to remove "${item.name}" from your cart?`)) {
                                removeItem(itemId)
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        {/* Helper warning if max stock reached */}
                        {isMaxStockReached && knownStock < 999 && (
                          <p className="flex items-center justify-center sm:justify-start gap-1 text-[11px] font-medium text-amber-700 pt-0.5">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Maximum available stock ({knownStock}) reached
                          </p>
                        )}
                      </div>

                      {/* Line Total */}
                      <div className="shrink-0 text-center sm:text-right sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <p className="text-xs text-slate-400 font-medium sm:hidden">Total:</p>
                        <p className="text-base font-extrabold text-slate-900 sm:text-lg">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Subtotal Summary Box */}
              <div className="w-full shrink-0 lg:w-80 space-y-4">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                    Order Summary
                  </h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                      <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 pt-1">
                      <span>Shipping & Taxes</span>
                      <span>Calculated at checkout</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <Button
                      asChild
                      className="w-full h-12 rounded-xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-500 shadow-sm transition-all text-base"
                    >
                      <Link href={checkoutHref} className="flex items-center justify-center gap-2">
                        Proceed to Checkout
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="ghost"
                      className="w-full h-10 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Link href="/browse">Continue Shopping</Link>
                    </Button>
                  </div>
                </div>

                {/* Trust Badge */}
                <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>100% Safe & Secure Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
