"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PublicLayout } from "@/components/site-layout"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { formatCurrency } from "@/lib/utils"
import type { AddressApi } from "@/app/api/customer/checkout/types"
import { MapPin, Banknote, Loader2, Pencil, Plus, Briefcase } from "lucide-react"

type AddressFormState = {
  addressType: AddressApi["addressType"]
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
}

const emptyAddressForm: AddressFormState = {
  addressType: "HOME",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
}

function formatSlotTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}:${mm} UTC`
}

export function ServiceBookClient({
  serviceId,
  serviceName,
  displayPrice,
  slotStartTime,
  slotEndTime,
}: {
  serviceId: string
  serviceName: string
  displayPrice: number | null
  slotStartTime: string | null
  slotEndTime: string | null
}) {
  const [addresses, setAddresses] = useState<AddressApi[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm)
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
    setError(null)
    setPlacing(true)
    try {
      const body: { serviceId: string; addressId: string; slotStartTime?: string; slotEndTime?: string } = {
        serviceId,
        addressId: selectedAddressId,
      }
      if (slotStartTime) body.slotStartTime = slotStartTime
      if (slotEndTime) body.slotEndTime = slotEndTime
      const res = await fetch("/api/customer/checkout/place-service-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to place order.")
        return
      }
      if (data.success) {
        window.location.href = "/my-orders"
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
      addressType: addr.addressType,
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
    if (
      !addressForm.fullName.trim() ||
      !addressForm.phone.trim() ||
      !addressForm.addressLine1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !addressForm.postalCode.trim() ||
      !addressForm.country.trim()
    ) {
      setError("Please fill all required fields.")
      return
    }
    setFormSubmitting(true)
    setError(null)
    const payload = {
      addressType: addressForm.addressType,
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

  const canPlace = displayPrice != null && selectedAddressId && !addressesLoading

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:py-8 overflow-x-hidden">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Book service</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">Enter your address and place the booking.</p>

        <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 md:grid-cols-2">
          <div className="space-y-6 min-w-0">
            <section className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 sm:text-lg">
                <MapPin className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                Delivery / service address
              </h2>
              {addressesLoading ? (
                <p className="mt-2 text-slate-500">Loading addresses…</p>
              ) : addresses.length === 0 ? (
                <p className="mt-2 text-slate-500">Add your address to proceed.</p>
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
                                {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city}, {addr.state}{" "}
                                {addr.postalCode}, {addr.country}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                  {addr.addressType === "HOME"
                                    ? "Home"
                                    : addr.addressType === "OFFICE"
                                      ? "Office"
                                      : "Other"}
                                </span>
                                {addr.isDefault && (
                                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Default
                                  </span>
                                )}
                              </div>
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
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 min-h-10 w-full sm:w-auto"
                      onClick={openAddForm}
                    >
                      <Plus className="mr-2 h-4 w-4 shrink-0" />
                      Add new address
                    </Button>
                  )}
                </>
              )}

              {!addressesLoading && (addresses.length === 0 || showAddressForm) && (
                <form
                  onSubmit={handleSaveAddress}
                  className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4"
                >
                  <h3 className="text-sm font-medium text-slate-700">
                    {editingAddressId ? "Edit address" : "Add new address"}
                  </h3>
                  <div>
                    <Label htmlFor="sb-addressType" className="text-xs sm:text-sm">Address type</Label>
                    <select
                      id="sb-addressType"
                      value={addressForm.addressType}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressType: e.target.value as AddressApi["addressType"] }))}
                      className="min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="HOME">Home</option>
                      <option value="OFFICE">Office</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="sb-fullName" className="text-xs sm:text-sm">Full name *</Label>
                      <Input
                        id="sb-fullName"
                        value={addressForm.fullName}
                        onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Full name"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sb-phone" className="text-xs sm:text-sm">Phone *</Label>
                      <Input
                        id="sb-phone"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sb-addressLine1" className="text-xs sm:text-sm">Address line 1 *</Label>
                    <Input
                      id="sb-addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
                      placeholder="Street address"
                      required
                      className="min-h-10 sm:min-h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sb-addressLine2" className="text-xs sm:text-sm">Address line 2</Label>
                    <Input
                      id="sb-addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
                      placeholder="Apt, suite, etc."
                      className="min-h-10 sm:min-h-9"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="sb-city" className="text-xs sm:text-sm">City *</Label>
                      <Input
                        id="sb-city"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sb-state" className="text-xs sm:text-sm">State *</Label>
                      <Input
                        id="sb-state"
                        value={addressForm.state}
                        onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sb-postalCode" className="text-xs sm:text-sm">Postal code *</Label>
                      <Input
                        id="sb-postalCode"
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                        placeholder="Postal code"
                        required
                        className="min-h-10 sm:min-h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sb-country" className="text-xs sm:text-sm">Country *</Label>
                    <Input
                      id="sb-country"
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeAddressForm}
                        disabled={formSubmitting}
                        className="min-h-10 w-full sm:w-auto"
                      >
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
              <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                Cash on Delivery (COD) — pay when you receive your order.
              </p>
            </section>
          </div>

          <div className="min-w-0">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:sticky md:top-4">
              <h2 className="text-base font-semibold text-slate-800 sm:text-lg">Booking summary</h2>
              <div className="mt-3 flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                  <Briefcase className="h-5 w-5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{serviceName}</p>
                  {slotStartTime && slotEndTime && (
                    <p className="mt-0.5 text-sm text-slate-600">
                      {formatSlotTime(slotStartTime)} – {formatSlotTime(slotEndTime)}
                    </p>
                  )}
                  <p className="mt-1 font-semibold text-slate-900">
                    {displayPrice != null ? formatCurrency(displayPrice) : "Price on request"}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 sm:text-base">
                  <span>Total</span>
                  <span>{displayPrice != null ? formatCurrency(displayPrice) : "—"}</span>
                </div>
                <p className="text-[10px] text-slate-500 sm:text-xs">COD: pay on delivery.</p>
                <Button
                  className="mt-4 w-full min-h-11 sm:min-h-12"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={placing || !canPlace}
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
            <Link href={"/service/" + serviceId}>← Back to service</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  )
}
