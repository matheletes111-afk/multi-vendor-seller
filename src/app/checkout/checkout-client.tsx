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
import { Plus, MapPin, Banknote, Loader2, ShoppingBag, Check, Pencil, X, ShieldCheck, Truck, Sparkles } from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"
import { GoogleAddressAutocomplete } from "@/components/google-address-autocomplete"
import { GoogleMapView } from "@/components/google-map-view"
import { AvailableCoupons } from "@/components/coupons/available-coupons"
import { resolveAdministrativeRegion } from "@/lib/shipping-calculator"

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
  latitude: number | null
  longitude: number | null
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
  latitude: null,
  longitude: null,
}

export function CheckoutClient() {
  const router = useRouter()
  const { items, isLoading: cartLoading, clearCart } = useCart()

  const [addresses, setAddresses] = useState<AddressApi[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm)
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [couponCode, setCouponCode] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Store names map: cartItemId/productId -> storeName
  const [itemStoreNames, setItemStoreNames] = useState<Record<string, string>>({})
  // Multi-vendor seller groups with shipping costs
  const [sellerGroups, setSellerGroups] = useState<
    { sellerId: string; sellerName: string; totalWeight: number; sellerDeliveryFee: number }[]
  >([])
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shippingBreakup, setShippingBreakup] = useState<any>(null)
  const [aiRegionResult, setAiRegionResult] = useState<{
    matchedRegion: string
    zone: string
    confidence: number
    reasoning: string
    isAiMatched: boolean
    charge: number
  } | null>(null)
  const [aiMatchingLoading, setAiMatchingLoading] = useState(false)

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  // Priority: AI-matched region > summary API matched region > deterministic resolve from state string
  const activeRegionName =
    aiRegionResult?.matchedRegion ||
    shippingBreakup?.matchedRegionName ||
    resolveAdministrativeRegion(selectedAddress?.state)
  const activeZoneName =
    aiRegionResult?.zone ||
    shippingBreakup?.matchedZoneName ||
    ""

  useEffect(() => {
    if (!selectedAddress) {
      setAiRegionResult(null)
      return
    }

    setAiMatchingLoading(true)
    fetch("/api/customer/checkout/ai-match-region", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressLine1: selectedAddress.addressLine1,
        addressLine2: selectedAddress.addressLine2,
        city: selectedAddress.city,
        state: selectedAddress.state,
        postalCode: selectedAddress.postalCode,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.data) {
          setAiRegionResult(data.data)
        }
      })
      .catch((err) => console.error("AI region matching error:", err))
      .finally(() => setAiMatchingLoading(false))
  }, [selectedAddressId, selectedAddress])

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

  // Fetch store names & delivery calculation for items in cart, re-fetch when address changes
  useEffect(() => {
    const url = selectedAddressId
      ? `/api/customer/checkout/summary?addressId=${encodeURIComponent(selectedAddressId)}`
      : "/api/customer/checkout/summary"
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.itemStoreNames) {
          setItemStoreNames(data.itemStoreNames)
        }
        if (data && typeof data.shipping === "number") {
          setDeliveryCharge(data.shipping)
        }
        if (data && Array.isArray(data.sellerGroups)) {
          setSellerGroups(data.sellerGroups)
        }
        if (data && data.shippingBreakup) {
          setShippingBreakup(data.shippingBreakup)
        }
      })
      .catch(() => {})
  }, [items, selectedAddressId])

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError("Please select a delivery address.")
      return
    }
    setError(null)
    setPlacing(true)
    try {
      const res = await fetch("/api/customer/checkout/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod: "COD",
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      })
      const data = (await res.json()) as PlaceOrderResponse
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to place order.")
        return
      }
      if (data.success && data.orders?.length) {
        clearCart()
        const firstOrder = data.orders[0]
        router.push("/order-success?orderId=" + encodeURIComponent(firstOrder.orderId))
        return
      }
      setError("Failed to place order.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPlacing(false)
    }
  }

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply ?? couponCode).trim()
    if (!targetCode) return
    setCouponCode(targetCode)
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch("/api/customer/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: targetCode,
          type: "PRODUCT",
          subtotal: cartSubtotal,
          items: productItems.map((i) => ({
            productId: i.productId,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAppliedCoupon(data.data)
        setCouponError(null)
      } else {
        setCouponError(data.error || "Failed to apply coupon")
        setAppliedCoupon(null)
      }
    } catch {
      setCouponError("Network error applying coupon")
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponError(null)
  }

  const openAddForm = () => {
    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
    setShowAddressForm(true)
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
      latitude: addr.latitude != null ? Number(addr.latitude) : null,
      longitude: addr.longitude != null ? Number(addr.longitude) : null,
    })
    setShowAddressForm(true)
  }

  const closeAddressForm = () => {
    setShowAddressForm(false)
    setEditingAddressId(null)
  }

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)
    try {
      if (editingAddressId) {
        const res = await fetch(`/api/customer/checkout/addresses/${editingAddressId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(addressForm),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          alert(typeof d.error === "string" ? d.error : "Failed to update address")
          return
        }
        const updated = (await res.json()) as AddressApi
        setAddresses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        closeAddressForm()
      } else {
        const res = await fetch("/api/customer/checkout/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(addressForm),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          alert(typeof d.error === "string" ? d.error : "Failed to save address")
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

  const productItems = items.filter((i) => i.productId)
  const cartSubtotal = productItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cartTax = productItems.reduce((sum, i) => sum + (i.gstAmount ?? 0), 0)
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const cartGrandTotal = Math.max(0, cartSubtotal + cartTax + deliveryCharge - couponDiscount)

  if (cartLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Checkout</h1>
          <PageLoader message="Loading checkout details…" className="min-h-[40vh]" />
        </div>
      </PublicLayout>
    )
  }

  if (productItems.length === 0 && !addressesLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 mb-4">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Your Cart is Empty</h1>
          <p className="mt-1 text-sm text-slate-500">Add items to your cart before proceeding to checkout.</p>
          <Button asChild className="mt-6 h-11 rounded-xl bg-amber-400 font-bold text-slate-900 hover:bg-amber-500 px-6">
            <Link href="/browse">Return to Shopping</Link>
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50/70 py-6 sm:py-10">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 md:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Checkout
              </h1>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Select your delivery address and review your order details
              </p>
            </div>


          </div>

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Address Selection & Payment Method */}
            <div className="space-y-6 lg:col-span-7">
              {/* 1. Delivery Address Section */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                      Delivery Address
                    </h2>
                  </div>
                  {!showAddressForm && addresses.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openAddForm}
                      className="h-8 rounded-xl text-xs font-bold border-amber-300 bg-amber-50/50 text-amber-950 hover:bg-amber-100 transition-all"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Address
                    </Button>
                  )}
                </div>

                {addressesLoading ? (
                  <div className="py-6 text-center text-sm text-slate-400">Loading saved addresses…</div>
                ) : null}

                {!addressesLoading && addresses.length > 0 && !showAddressForm && (
                  <div className="mt-4 space-y-3">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={[
                            "relative flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-all",
                            isSelected
                              ? "border-amber-400 bg-gradient-to-r from-amber-50/60 to-orange-50/30 shadow-xs ring-1 ring-amber-400/40"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 shrink-0">
                              {isSelected ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-xs">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full border border-slate-300 bg-white" />
                              )}
                            </div>
                            <div className="space-y-1 text-xs sm:text-sm min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm sm:text-base">
                                  {addr.fullName}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                  {addr.addressType}
                                </span>
                                {addr.isDefault && (
                                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-extrabold">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 font-semibold">{addr.phone}</p>
                              <p className="text-slate-700 leading-relaxed break-words">
                                {addr.addressLine1}
                                {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city},{" "}
                                {addr.state} {addr.postalCode}, {addr.country}
                              </p>

                              {isSelected && (
                                <div className="mt-2.5">
                                  {aiMatchingLoading ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800 animate-pulse">
                                      <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-spin" />
                                      <span>Determining delivery zone…</span>
                                    </div>
                                  ) : aiRegionResult ? (
                                    <div className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-950">
                                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span className="text-[11px] text-slate-600 font-medium">Delivery Zone:</span>
                                      <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                        📍 {aiRegionResult.zone === "Administrative Provinces" || aiRegionResult.matchedRegion === "Other" || aiRegionResult.matchedRegion === aiRegionResult.zone
                                          ? aiRegionResult.matchedRegion
                                          : `${aiRegionResult.matchedRegion} (${aiRegionResult.zone})`}
                                      </span>
                                      {aiRegionResult.charge > 0 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                          +{formatCurrency(aiRegionResult.charge)}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditForm(addr)
                            }}
                            className="h-8 w-8 shrink-0 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            title="Edit Address"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add / Edit Address Form */}
                {!addressesLoading && (addresses.length === 0 || showAddressForm) && (
                  <form onSubmit={handleSaveAddress} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <h3 className="text-sm font-bold text-slate-900">
                        {editingAddressId ? "Edit Delivery Address" : "Add New Delivery Address"}
                      </h3>
                      {addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={closeAddressForm}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Google Autocomplete & Map Locator */}
                    <div>
                      <Label className="text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-amber-600" />
                        Search Location with Google Maps
                      </Label>
                      <GoogleAddressAutocomplete
                        key={editingAddressId || "new-address"}
                        defaultValue={[addressForm.addressLine1, addressForm.city, addressForm.state].filter(Boolean).join(", ")}
                        onAddressSelect={(parsed) => {
                          setAddressForm((f) => ({
                            ...f,
                            addressLine1: parsed.addressLine1 || f.addressLine1,
                            addressLine2: parsed.addressLine2 || f.addressLine2,
                            city: parsed.city || f.city,
                            state: parsed.state || f.state,
                            postalCode: parsed.postalCode || f.postalCode,
                            country: parsed.country || f.country,
                            latitude: parsed.lat != null ? parsed.lat : f.latitude,
                            longitude: parsed.lng != null ? parsed.lng : f.longitude,
                          }))
                        }}
                      />

                      {(addressForm.latitude != null || addressForm.addressLine1) && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                          <GoogleMapView
                            lat={addressForm.latitude}
                            lng={addressForm.longitude}
                            address={[addressForm.addressLine1, addressForm.city, addressForm.state, addressForm.postalCode].filter(Boolean).join(", ")}
                            title={addressForm.fullName || "Pin Location"}
                            height="180px"
                            draggable
                            onLocationChange={(loc) => {
                              setAddressForm((f) => ({
                                ...f,
                                latitude: loc.lat,
                                longitude: loc.lng,
                                ...(loc.addressLine1 ? { addressLine1: loc.addressLine1 } : {}),
                                ...(loc.city ? { city: loc.city } : {}),
                                ...(loc.state ? { state: loc.state } : {}),
                                ...(loc.postalCode ? { postalCode: loc.postalCode } : {}),
                                ...(loc.country ? { country: loc.country } : {}),
                              }))
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="addressType" className="text-xs font-semibold text-slate-700">Address Type</Label>
                        <select
                          id="addressType"
                          value={addressForm.addressType}
                          onChange={(e) => setAddressForm((f) => ({ ...f, addressType: e.target.value as AddressApi["addressType"] }))}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="HOME">Home</option>
                          <option value="OFFICE">Office</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">Full Name *</Label>
                        <Input
                          id="fullName"
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm((f) => ({ ...f, fullName: e.target.value }))}
                          placeholder="John Doe"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          value={addressForm.phone}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/(?!^\+)[^\d]/g, "")
                            setAddressForm((f) => ({ ...f, phone: sanitized }))
                          }}
                          placeholder="e.g. +23288123456"
                          required
                          pattern="^\+?[0-9]{7,15}$"
                          title="Phone number must contain only numbers (7 to 15 digits)."
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="addressLine1" className="text-xs font-semibold text-slate-700">Address Line 1 *</Label>
                        <Input
                          id="addressLine1"
                          value={addressForm.addressLine1}
                          onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
                          placeholder="Street address"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="addressLine2" className="text-xs font-semibold text-slate-700">Address Line 2</Label>
                        <Input
                          id="addressLine2"
                          value={addressForm.addressLine2}
                          onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
                          placeholder="Apt, Suite, Floor"
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="city" className="text-xs font-semibold text-slate-700">City *</Label>
                        <Input
                          id="city"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                          placeholder="City"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="state" className="text-xs font-semibold text-slate-700">State *</Label>
                        <Input
                          id="state"
                          value={addressForm.state}
                          onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                          placeholder="State"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="postalCode" className="text-xs font-semibold text-slate-700">Postal Code *</Label>
                        <Input
                          id="postalCode"
                          value={addressForm.postalCode}
                          onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                          placeholder="Postal Code"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="country" className="text-xs font-semibold text-slate-700">Country *</Label>
                        <Input
                          id="country"
                          value={addressForm.country}
                          onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                          placeholder="Country"
                          required
                          className="mt-1 h-9 text-xs sm:text-sm rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button type="submit" disabled={formSubmitting} className="h-9 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs px-5 rounded-lg shadow-xs">
                        {formSubmitting ? "Saving Address…" : editingAddressId ? "Update Address" : "Save Address"}
                      </Button>
                      {addresses.length >= 1 && (
                        <Button type="button" variant="outline" onClick={closeAddressForm} disabled={formSubmitting} className="h-9 text-xs rounded-lg">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* 2. Payment Method Section */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold">
                    <Banknote className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    Payment Method
                  </h2>
                </div>

                <div className="mt-4 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-50/60 to-orange-50/30 p-4 ring-1 ring-amber-400/30 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-xs shrink-0">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                        <span>Cash on Delivery (COD)</span>
                        <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-950 uppercase tracking-wide">
                          Pay on Delivery
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Pay with cash directly to the delivery provider when your items arrive at your doorstep.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Order Summary */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm sticky top-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">Order Summary</h2>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                    {productItems.length} {productItems.length === 1 ? "Item" : "Items"}
                  </span>
                </div>

                {/* Items Scrollable List */}
                <ul className="max-h-60 space-y-3 overflow-y-auto pr-1">
                  {productItems.map((item) => {
                    const itemId = getCartItemId(item)
                    const subtotal = item.price * item.quantity
                    const gstAmount = item.gstAmount ?? 0
                    const lineTotal = item.lineTotal ?? subtotal + gstAmount
                    const storeName =
                      itemStoreNames[itemId] ||
                      (item.id ? itemStoreNames[item.id] : undefined) ||
                      (item.productId ? itemStoreNames[item.productId] : undefined)

                    return (
                      <li key={itemId} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition-all hover:bg-slate-50">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <ShoppingBag className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.name}</p>
                          {storeName && (
                            <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                              <span>🏪</span> {storeName}
                            </p>
                          )}
                          <div className="flex flex-wrap items-end justify-between gap-1 text-[11px] text-slate-600">
                            <div>
                              <span>Qty: {item.quantity} × {formatCurrency(item.price)}</span>
                              {gstAmount > 0 && (
                                <span className="block text-[10px] text-slate-500 font-medium">
                                  + Tax (GST): {formatCurrency(gstAmount)}
                                </span>
                              )}
                            </div>
                            <span className="font-extrabold text-slate-900">{formatCurrency(lineTotal)}</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Coupon Section */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Promo / Coupon Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={couponLoading || !!appliedCoupon}
                      className="h-9 text-xs rounded-xl bg-slate-50"
                    />
                    {appliedCoupon ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveCoupon}
                        className="h-9 text-xs rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 font-bold"
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={couponLoading || !couponCode.trim()}
                        onClick={() => handleApplyCoupon()}
                        className="h-9 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4"
                      >
                        {couponLoading ? "..." : "Apply"}
                      </Button>
                    )}
                  </div>
                  {couponError && <p className="text-[11px] font-semibold text-rose-600">{couponError}</p>}
                  {appliedCoupon && (
                    <p className="text-[11px] font-bold text-emerald-600">
                      Saved {formatCurrency(appliedCoupon.discountAmount)}!
                    </p>
                  )}

                  <AvailableCoupons
                    type="PRODUCT"
                    subtotal={cartSubtotal}
                    onApplyCoupon={(code) => handleApplyCoupon(code)}
                    appliedCode={appliedCoupon?.code}
                    loading={couponLoading}
                  />
                </div>

                {/* Price Summary Breakdown */}
                <div className="border-t border-slate-100 pt-3 space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(cartSubtotal)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Total GST (Tax)</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(cartTax)}</span>
                  </div>

                  {sellerGroups.length > 1 ? (
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs space-y-2.5 my-2">
                      <p className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                        <Truck className="h-3.5 w-3.5 text-amber-700" /> Multi-Vendor Delivery ({sellerGroups.length} Sellers)
                      </p>
                      {sellerGroups.map((group, idx) => {
                        const sb = (group as any).shippingBreakup
                        return (
                          <div key={group.sellerId || idx} className="bg-white/80 p-2.5 rounded-lg border border-amber-200/50 space-y-1">
                            <div className="flex justify-between items-center text-amber-950 font-bold text-xs">
                              <span>🏪 {group.sellerName}</span>
                              <span className="font-extrabold text-slate-900">
                                {group.sellerDeliveryFee <= 0 ? (
                                  <span className="text-emerald-700">FREE</span>
                                ) : (
                                  formatCurrency(group.sellerDeliveryFee)
                                )}
                              </span>
                            </div>
                            {sb && (sb.weightShippingFee > 0 || sb.dimensionShippingFee > 0 || sb.regionShippingFee > 0) && (
                              <div className="text-[10px] text-slate-500 pl-4 space-y-0.5 border-l-2 border-amber-300/60 mt-1">
                                {sb.weightShippingFee > 0 && (
                                  <div className="flex justify-between">
                                    <span>Weight charge</span>
                                    <span className="font-medium text-slate-700">{formatCurrency(sb.weightShippingFee)}</span>
                                  </div>
                                )}
                                {sb.dimensionShippingFee > 0 && (
                                  <div className="flex justify-between">
                                    <span>Dimension charge</span>
                                    <span className="font-medium text-slate-700">{formatCurrency(sb.dimensionShippingFee)}</span>
                                  </div>
                                )}
                                {sb.regionShippingFee > 0 && (
                                  <div className="flex justify-between">
                                    <span>
                                      Regional Surcharge (
                                      {aiRegionResult
                                        ? aiRegionResult.zone === "Administrative Provinces" || aiRegionResult.matchedRegion === "Other" || aiRegionResult.matchedRegion === aiRegionResult.zone
                                          ? aiRegionResult.matchedRegion
                                          : `${aiRegionResult.matchedRegion} — ${aiRegionResult.zone}`
                                        : activeRegionName || "Other"}
                                      )
                                    </span>
                                    <span className="font-medium text-slate-700">{formatCurrency(sb.regionShippingFee)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div className="flex justify-between border-t border-amber-200/80 pt-1.5 text-amber-950 font-extrabold text-xs">
                        <span>Total Shipping</span>
                        <span className="text-amber-700">{deliveryCharge <= 0 ? "FREE" : formatCurrency(deliveryCharge)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee</span>
                      <span className="font-semibold">
                        {deliveryCharge <= 0 ? (
                          <span className="text-emerald-700 font-bold">FREE</span>
                        ) : (
                          formatCurrency(deliveryCharge)
                        )}
                      </span>
                    </div>
                  )}

                  {/* Shipping Breakup — shown when there are delivery fees */}
                  {shippingBreakup && deliveryCharge > 0 && (
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-[11px] text-slate-600 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                        <p className="font-black text-slate-800 text-[11px] uppercase tracking-wide">Delivery Breakdown</p>
                        <span className="text-[10px] text-emerald-900 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200/80">
                          📍 {activeZoneName && activeZoneName !== "Administrative Provinces" && activeZoneName !== "Other" && activeRegionName !== activeZoneName
                            ? `${activeRegionName} (${activeZoneName})`
                            : activeRegionName || "Other"}
                        </span>
                      </div>
                      {shippingBreakup.weightShippingFee > 0 && (
                        <div className="flex justify-between">
                          <span>Weight-based Fee</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(shippingBreakup.weightShippingFee)}</span>
                        </div>
                      )}
                      {shippingBreakup.dimensionShippingFee > 0 && (
                        <div className="flex justify-between">
                          <span>Dimension-based Fee</span>
                          <span className="font-semibold text-slate-700">{formatCurrency(shippingBreakup.dimensionShippingFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-200/60">
                        <span>
                          Regional Surcharge
                          {activeRegionName
                            ? ` (${activeZoneName && activeZoneName !== "Administrative Provinces" && activeZoneName !== "Other" && activeRegionName !== activeZoneName
                                ? `${activeRegionName} — ${activeZoneName}`
                                : activeRegionName})`
                            : ""}
                        </span>
                        <span className="font-black text-emerald-800">
                          {formatCurrency(aiRegionResult?.charge ?? shippingBreakup.regionShippingFee ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  {appliedCoupon && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Coupon Discount ({appliedCoupon.code})</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                    <span>Grand Total</span>
                    <span className="text-amber-600 text-lg">{formatCurrency(cartGrandTotal)}</span>
                  </div>
                </div>

                {/* Place Order CTA */}
                <div className="pt-2 space-y-3">
                  <Button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing || !selectedAddressId || productItems.length === 0}
                    className="w-full h-12 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-base hover:bg-amber-500 shadow-sm transition-all disabled:opacity-50"
                  >
                    {placing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Placing Order…
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>

                  {error && (
                    <p className="text-center text-xs font-semibold text-rose-600" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium pt-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>100% Safe & Secure Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
