"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { useCart } from "@/app/cart/cart-context"
import { getCartItemId } from "@/app/cart/cart-types"
import { formatCurrency } from "@/lib/utils"
import type { AddressApi } from "@/app/api/customer/checkout/types"
import type { PlaceOrderResponse } from "@/app/api/customer/checkout/types"
import { MapPin, Banknote, Loader2, Pencil, Plus } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"

const emptyAddressForm = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
}

export function CheckoutClient() {
  const router = useRouter()
  const { items, totalItems, isLoading: cartLoading } = useCart()
  const [addresses, setAddresses] = useState<AddressApi[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState(emptyAddressForm)
  const [formSubmitting, setFormSubmitting] = useState(false)

  const fetchAddresses = useCallback(async () => {
    setAddressesLoading(true)
    try {
      const res = await fetch("/api/customer/checkout/addresses", { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as AddressApi[]
        const list = Array.isArray(data) ? data : []
        setAddresses(list)
        const first = list.length > 0 ? list[0] : null
        if (first && !selectedAddressId) setSelectedAddressId(first.id)
        if (first && selectedAddressId && !list.some((a: AddressApi) => a.id === selectedAddressId)) {
          setSelectedAddressId(first.id)
        }
        if (list.length === 0) {
          setShowAddressForm(true)
          setEditingAddressId(null)
          setAddressForm(emptyAddressForm)
        } else {
          setShowAddressForm(false)
          setEditingAddressId(null)
        }
      }
    } finally {
      setAddressesLoading(false)
    }
  }, [selectedAddressId])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError("Please select a delivery address.")
      return
    }
    if (items.length === 0) {
      setError("Your cart is empty.")
      return
    }
    setError(null)
    setPlacing(true)
    try {
      const res = await fetch("/api/customer/checkout/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addressId: selectedAddressId }),
      })
      const data = (await res.json()) as PlaceOrderResponse | { error?: string }
      if (!res.ok) {
        setError("error" in data && typeof data.error === "string" ? data.error : "Failed to place order.")
        return
      }
      if ("success" in data && data.success) {
        window.location.href = "/customer/orders"
        return
      }
      setError("Failed to place order.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPlacing(false)
    }
  }

  const openEditForm = (addr: AddressApi) => {
    setEditingAddressId(addr.id)
    setAddressForm({
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 ?? "",
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
    })
    setShowAddressForm(true)
    setError(null)
  }

  const openAddForm = () => {
    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
    setShowAddressForm(true)
    setError(null)
  }

  const closeAddressForm = () => {
    setShowAddressForm(false)
    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
  }

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addressForm.fullName.trim() || !addressForm.phone.trim() || !addressForm.addressLine1.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.postalCode.trim() || !addressForm.country.trim()) {
      setError("Please fill all required fields.")
      return
    }
    setFormSubmitting(true)
    setError(null)
    const payload = {
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      addressLine1: addressForm.addressLine1.trim(),
      addressLine2: addressForm.addressLine2.trim() || null,
      city: addressForm.city.trim(),
      state: addressForm.state.trim(),
      postalCode: addressForm.postalCode.trim(),
      country: addressForm.country.trim(),
      isDefault: editingAddressId ? undefined : addresses.length === 0,
    }
    try {
      if (editingAddressId) {
        const res = await fetch(`/api/customer/checkout/addresses/${editingAddressId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
          ...payload,
          isDefault: addresses.find((a) => a.id === editingAddressId)?.isDefault ?? false,
        }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          setError(typeof err.error === "string" ? err.error : "Failed to update address.")
          return
        }
        const updated = (await res.json()) as AddressApi
        setAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        setSelectedAddressId(updated.id)
        closeAddressForm()
      } else {
        const res = await fetch("/api/customer/checkout/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...payload, isDefault: payload.isDefault ?? addresses.length === 0 }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          setError(typeof err.error === "string" ? err.error : "Failed to add address.")
          return
        }
        const created = (await res.json()) as AddressApi
        setAddresses((prev) => [...prev, created])
        setSelectedAddressId(created.id)
        closeAddressForm()
      }
    } finally {
      setFormSubmitting(false)
    }
  }

  const cartSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartTax = items.reduce((sum, i) => sum + (i.gstAmount ?? 0), 0)
  const cartGrandTotal = items.reduce(
    (sum, i) => sum + (i.lineTotal ?? i.price * i.quantity + (i.gstAmount ?? 0)),
    0
  )

  if (cartLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8 overflow-x-hidden">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Checkout</h1>
          <PageLoader message="Loading your cart…" className="min-h-[40vh]" />
        </div>
      </PublicLayout>
    )
  }

  if (items.length === 0 && !addressesLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-lg px-3 py-8 text-center sm:px-4 sm:py-12 overflow-x-hidden">
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Checkout</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Your cart is empty.</p>
          <Button asChild className="mt-6 min-h-11 w-full sm:w-auto">
            <Link href="/cart">View cart</Link>
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:py-8 overflow-x-hidden">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Checkout</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>

        <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 md:grid-cols-2">
          <div className="space-y-6 min-w-0">
            <section className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 sm:text-lg">
                <MapPin className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Delivery address
              </h2>
              {addressesLoading ? (
                <p className="mt-2 text-slate-500">Loading addresses…</p>
              ) : addresses.length === 0 ? (
                <p className="mt-2 text-slate-500">Add your delivery address to proceed.</p>
              ) : null}

              {!addressesLoading && addresses.length >= 1 && (
                <>
                  <ul className="mt-3 space-y-2">
                    {addresses.map((addr) => (
                      <li key={addr.id}>
                        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20 sm:gap-3">
                          <label className="flex min-w-0 flex-1 cursor-pointer gap-2 sm:gap-3">
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                              className="mt-1.5 h-4 w-4 shrink-0 touch-manipulation"
                            />
                            <div className="min-w-0 text-xs sm:text-sm break-words">
                              <p className="font-medium text-slate-900">{addr.fullName}</p>
                              <p className="text-slate-600">{addr.phone}</p>
                              <p className="text-slate-700 break-words">
                                {addr.addressLine1}
                                {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                              </p>
                              {addr.isDefault && (
                                <span className="mt-1 inline-block text-xs text-primary">Default</span>
                              )}
                            </div>
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 shrink-0 p-0 text-slate-600 hover:text-slate-900 touch-manipulation sm:h-8 sm:w-8"
                            onClick={() => openEditForm(addr)}
                            aria-label="Edit address"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!showAddressForm && (
                    <Button type="button" variant="outline" className="mt-3 min-h-10 w-full sm:w-auto" onClick={openAddForm}>
                      <Plus className="mr-2 h-4 w-4 shrink-0" />
                      Add new address
                    </Button>
                  )}
                </>
              )}

              {!addressesLoading && (addresses.length === 0 || showAddressForm) && (
                <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-slate-700">
                    {editingAddressId ? "Edit address" : "Add new address"}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="fullName" className="text-xs sm:text-sm">Full name *</Label>
                      <Input
                        id="fullName"
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Full name"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-xs sm:text-sm">Phone *</Label>
                      <Input
                        id="phone"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="addressLine1" className="text-xs sm:text-sm">Address line 1 *</Label>
                    <Input
                      id="addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
                      placeholder="Street address"
                      required
                      className="min-h-10 sm:min-h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="addressLine2" className="text-xs sm:text-sm">Address line 2</Label>
                    <Input
                      id="addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
                      placeholder="Apt, suite, etc."
                      className="min-h-10 sm:min-h-9"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city" className="text-xs sm:text-sm">City *</Label>
                      <Input
                        id="city"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state" className="text-xs sm:text-sm">State *</Label>
                      <Input
                        id="state"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode" className="text-xs sm:text-sm">Postal code *</Label>
                      <Input
                        id="postalCode"
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                        placeholder="Postal code"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="country" className="text-xs sm:text-sm">Country *</Label>
                    <Input
                      id="country"
                      value={addressForm.country}
                      onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="Country"
                      required
                      className="min-h-10 sm:min-h-9"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" disabled={formSubmitting} className="min-h-10 w-full sm:w-auto">
                      {formSubmitting ? "Saving…" : editingAddressId ? "Update address" : "Save address"}
                    </Button>
                    {addresses.length >= 1 && (
                      <Button type="button" variant="outline" onClick={closeAddressForm} disabled={formSubmitting} className="min-h-10 w-full sm:w-auto">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </section>

            <section className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 sm:text-lg">
                <Banknote className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Payment
              </h2>
              <p className="mt-2 text-xs text-slate-600 sm:text-sm">Cash on Delivery (COD) — pay when you receive your order.</p>
            </section>
          </div>

          <div className="min-w-0">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:sticky md:top-4">
              <h2 className="text-base font-semibold text-slate-800 sm:text-lg">Order summary</h2>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto sm:max-h-72 sm:space-y-3">
                {items.map((item) => {
                  const itemId = getCartItemId(item)
                  const subtotal = item.price * item.quantity
                  const gstAmount = item.gstAmount ?? 0
                  const lineTotal =
                    item.lineTotal ?? subtotal + gstAmount
                  return (
                    <li key={itemId} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs sm:p-3 sm:text-sm">
                      <div className="flex gap-2 sm:gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-white sm:h-12 sm:w-12">
                          {item.image ? (
                            <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width: 640px) 40px, 48px" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">{item.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-slate-600 sm:mt-1 sm:gap-x-2">
                            <span>Qty: {item.quantity}</span>
                            <span>× {formatCurrency(item.price)}</span>
                            <span className="font-medium text-slate-700">
                              Subtotal: {formatCurrency(subtotal)}
                            </span>
                            {item.hasGst && gstAmount > 0 ? (
                              <span className="text-[10px] text-emerald-700 sm:text-xs">
                                GST: {formatCurrency(gstAmount)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 sm:text-xs">No GST</span>
                            )}
                          </div>
                          <p className="mt-0.5 font-semibold text-slate-900 sm:mt-1">
                            Line total: {formatCurrency(lineTotal)}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-xs text-slate-700 sm:text-sm">
                  <span>Subtotal ({items.length} item(s))</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                {cartTax > 0 && (
                  <div className="flex justify-between text-xs text-slate-700 sm:text-sm">
                    <span>Tax (GST)</span>
                    <span>{formatCurrency(cartTax)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 sm:text-base">
                  <span>Grand total</span>
                  <span>{formatCurrency(cartGrandTotal)}</span>
                </div>
                <p className="text-[10px] text-slate-500 sm:text-xs">COD: pay on delivery.</p>
                <Button
                  className="mt-4 w-full min-h-11 sm:min-h-12"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={placing || !selectedAddressId || items.length === 0}
                >
                  {placing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                      Placing order…
                    </>
                  ) : (
                    "Place order"
                  )}
                </Button>
                {error && (
                  <p className="mt-3 text-xs text-destructive sm:text-sm" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-6">
          <Button variant="ghost" asChild className="min-h-10 w-full sm:w-auto">
            <Link href="/cart">← Back to cart</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}
