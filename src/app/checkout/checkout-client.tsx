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

  if (cartLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
          <PageLoader message="Loading your cart…" className="min-h-[40vh]" />
        </div>
      </PublicLayout>
    )
  }

  if (items.length === 0 && !addressesLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-lg px-4 py-12 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Checkout</h1>
          <p className="mt-2 text-slate-600">Your cart is empty.</p>
          <Button asChild className="mt-6">
            <Link href="/cart">View cart</Link>
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-1 text-slate-600">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <MapPin className="h-5 w-5" />
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
                        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
                          <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                              className="mt-1 shrink-0"
                            />
                            <div className="min-w-0 text-sm">
                              <p className="font-medium text-slate-900">{addr.fullName}</p>
                              <p className="text-slate-600">{addr.phone}</p>
                              <p className="text-slate-700">
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
                            className="shrink-0 text-slate-600 hover:text-slate-900"
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
                    <Button type="button" variant="outline" className="mt-3" onClick={openAddForm}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add new address
                    </Button>
                  )}
                </>
              )}

              {!addressesLoading && (addresses.length === 0 || showAddressForm) && (
                <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-medium text-slate-700">
                    {editingAddressId ? "Edit address" : "Add new address"}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="fullName">Full name *</Label>
                      <Input
                        id="fullName"
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="addressLine1">Address line 1 *</Label>
                    <Input
                      id="addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
                      placeholder="Street address"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="addressLine2">Address line 2</Label>
                    <Input
                      id="addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
                      placeholder="Apt, suite, etc."
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal code *</Label>
                      <Input
                        id="postalCode"
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                        placeholder="Postal code"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={addressForm.country}
                      onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="Country"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={formSubmitting}>
                      {formSubmitting ? "Saving…" : editingAddressId ? "Update address" : "Save address"}
                    </Button>
                    {addresses.length >= 1 && (
                      <Button type="button" variant="outline" onClick={closeAddressForm} disabled={formSubmitting}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Banknote className="h-5 w-5" />
                Payment
              </h2>
              <p className="mt-2 text-slate-600">Cash on Delivery (COD) — pay when you receive your order.</p>
            </section>
          </div>

          <div>
            <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Order summary</h2>
              <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {items.map((item) => {
                  const itemId = getCartItemId(item)
                  const lineTotal = item.price * item.quantity
                  return (
                    <li key={itemId} className="flex gap-3 text-sm">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100">
                        {item.image ? (
                          <Image src={item.image} alt={item.name} fill className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.name}</p>
                        <p className="text-slate-500">
                          {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(lineTotal)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Tax (GST) may apply. COD: pay on delivery.</p>
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={placing || !selectedAddressId || items.length === 0}
                >
                  {placing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Placing order…
                    </>
                  ) : (
                    "Place order"
                  )}
                </Button>
                {error && (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="ghost" asChild>
            <Link href="/cart">← Back to cart</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}
