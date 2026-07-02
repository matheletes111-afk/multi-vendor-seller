"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, Plus, MapPin, User, Phone, Check, CreditCard, ShieldAlert } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import { formatCurrency } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { PublicLayout } from "@/components/site-layout"

type Address = {
  id: string
  fullName: string
  addressType: "HOME" | "OFFICE" | "OTHER"
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}

type FoodItem = {
  id: string
  name: string
  price: number
  restaurantSellerId: string
  restaurantName: string
  images: any
  image: string | null
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const foodItemId = searchParams.get("foodItemId")
  const quantityRaw = searchParams.get("quantity")
  const quantity = parseInt(quantityRaw || "1")

  const [food, setFood] = useState<FoodItem | null>(null)
  const [loadingFood, setLoadingFood] = useState(true)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")

  // New Address Form State
  const [showNewForm, setShowNewForm] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("Sierra Leone")
  const [addressType, setAddressType] = useState<"HOME" | "OFFICE" | "OTHER">("HOME")
  const [saveToProfile, setSaveToProfile] = useState(true)

  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const fetchFood = async () => {
    if (!foodItemId) return
    try {
      const res = await fetch(`/api/customer/foods/${foodItemId}`)
      const data = await res.json()
      if (data.success) {
        setFood(data.data)
      }
    } catch (err) {
      console.error("Failed to load food item:", err)
    } finally {
      setLoadingFood(false)
    }
  }

  const fetchAddresses = async () => {
    try {
      const res = await fetch("/api/customer/checkout/addresses")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setAddresses(data)
          const def = data.find(a => a.isDefault) || data[0]
          if (def) setSelectedAddressId(def.id)
        }
      }
    } catch (err) {
      console.error("Failed to load addresses:", err)
    } finally {
      setLoadingAddresses(false)
    }
  }

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push(`/customer/login?callbackUrl=/foods/checkout?foodItemId=${foodItemId}&quantity=${quantity}`)
      return
    }
    if (session.user.role !== "CUSTOMER") {
      router.push("/")
      return
    }
    fetchFood()
    fetchAddresses()
  }, [session, status, foodItemId])

  const handlePlaceOrder = async () => {
    setErrorMessage("")
    setSubmittingOrder(true)

    try {
      let deliveryDetails: Omit<Address, "id" | "isDefault">

      if (showNewForm || !selectedAddressId) {
        if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode || !country) {
          setErrorMessage("Please fill all required address fields.")
          setSubmittingOrder(false)
          return
        }

        deliveryDetails = {
          fullName,
          phone,
          addressLine1,
          addressLine2: addressLine2 || null,
          city,
          state,
          postalCode,
          country,
          addressType
        }

        // Save to address book if selected
        if (saveToProfile) {
          const res = await fetch("/api/customer/checkout/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...deliveryDetails, isDefault: addresses.length === 0 })
          })
          if (!res.ok) {
            console.warn("Failed to save address to address book, continuing with order placement")
          }
        }
      } else {
        const addr = addresses.find(a => a.id === selectedAddressId)
        if (!addr) {
          setErrorMessage("Selected address not found.")
          setSubmittingOrder(false)
          return
        }
        deliveryDetails = addr
      }

      // Submit checkout
      const orderRes = await fetch("/api/customer/foods/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSellerId: food?.restaurantSellerId,
          items: [{ foodItemId: food?.id, quantity }],
          deliveryFullName: deliveryDetails.fullName,
          deliveryPhone: deliveryDetails.phone,
          deliveryAddressLine1: deliveryDetails.addressLine1,
          deliveryAddressLine2: deliveryDetails.addressLine2,
          deliveryCity: deliveryDetails.city,
          deliveryState: deliveryDetails.state,
          deliveryPostalCode: deliveryDetails.postalCode,
          deliveryCountry: deliveryDetails.country
        })
      })

      const orderData = await orderRes.json()
      if (orderData.success) {
        router.push("/customer/food-orders")
      } else {
        setErrorMessage(orderData.error || "Failed to place order. Please try again.")
      }
    } catch (error: any) {
      setErrorMessage("An unexpected error occurred.")
      console.error(error)
    } finally {
      setSubmittingOrder(false)
    }
  }

  if (loadingFood || loadingAddresses) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4 max-w-lg">
        <div className="h-12 w-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-bold">Setting up checkout...</p>
      </div>
    )
  }

  if (!food) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-6 max-w-md">
        <ShieldAlert className="h-16 w-16 text-rose-500 mx-auto" />
        <h2 className="text-xl font-black text-slate-800">Checkout Error</h2>
        <p className="text-slate-500">Could not find details of the food item to place order.</p>
        <Link href="/foods">
          <Button className="bg-rose-500 text-white rounded-2xl font-bold px-6">Return to Menu</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Checkout</h1>
        <p className="text-slate-500 font-medium text-sm">Please review your delivery details and place your order.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Columns: Address Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Address Selector */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" /> Delivery Address
            </h2>

            {!showNewForm && addresses.length > 0 ? (
              <div className="space-y-3">
                <div className="grid gap-3">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`border rounded-2xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        selectedAddressId === addr.id
                          ? "border-rose-500 bg-rose-50/10 shadow-sm"
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        selectedAddressId === addr.id
                          ? "border-rose-500 bg-rose-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}>
                        {selectedAddressId === addr.id && <Check className="h-3 w-3" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{addr.fullName}</span>
                          <span className="bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            {addr.addressType}
                          </span>
                          {addr.isDefault && (
                            <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs mt-1.5 leading-relaxed font-semibold">
                          {addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ""}{addr.city}, {addr.state} - {addr.postalCode}, {addr.country}
                        </p>
                        <p className="text-slate-500 text-[11px] font-bold mt-1">Phone: {addr.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowNewForm(true)}
                  className="rounded-xl border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-600 h-10 w-full flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Add New Address
                </Button>
              </div>
            ) : (
              // New Address Form
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number *</label>
                    <Input
                      placeholder="e.g. +232 88 123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address Line 1 *</label>
                  <Input
                    placeholder="Street address, P.O. box, company name"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="rounded-xl border-slate-200 text-sm h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address Line 2 (Optional)</label>
                  <Input
                    placeholder="Apartment, suite, unit, building, floor, etc."
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="rounded-xl border-slate-200 text-sm h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">City *</label>
                    <Input
                      placeholder="e.g. Freetown"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">State / Region *</label>
                    <Input
                      placeholder="e.g. Western Area"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Postal / ZIP Code *</label>
                    <Input
                      placeholder="e.g. 00232"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Country *</label>
                    <Input
                      placeholder="e.g. Sierra Leone"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="rounded-xl border-slate-200 text-sm h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address Type</label>
                  <div className="flex gap-2">
                    {(["HOME", "OFFICE", "OTHER"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAddressType(type)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                          addressType === type
                            ? "bg-slate-900 border-slate-900 text-white shadow-md"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="save_addr"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                  />
                  <label htmlFor="save_addr" className="text-xs font-bold text-slate-600 cursor-pointer">
                    Save address to my address book for future orders
                  </label>
                </div>

                {addresses.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowNewForm(false)}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600"
                  >
                    Cancel &amp; select saved address
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-rose-500" /> Payment Mode
            </h2>

            <div className="border border-rose-500 bg-rose-50/10 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Cash on Delivery (COD)</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">Pay in cash when delivery agent arrives</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-lg space-y-6">
            <h3 className="font-black text-slate-900 text-base">Order Summary</h3>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  {(() => {
                    let imageUrl: string | null = null;
                    if (Array.isArray(food.images) && food.images.length > 0) {
                      imageUrl = food.images[0];
                    } else if (food.images && typeof food.images === 'string') {
                      try {
                        const parsed = JSON.parse(food.images);
                        if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                      } catch {}
                    }
                    if (!imageUrl && food.image) {
                      imageUrl = food.image;
                    }
                    return imageUrl ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm shrink-0">
                        <img src={imageUrl} alt={food.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-muted-foreground font-bold shrink-0">No Image</div>
                    );
                  })()}
                  <div>
                    <p className="font-bold text-slate-800 line-clamp-2">{food.name}</p>
                    <p className="text-slate-400 text-xs font-bold mt-0.5">By {food.restaurantName}</p>
                  </div>
                </div>
                <span className="font-bold text-slate-600 shrink-0">x {quantity}</span>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Price per item</span>
                  <span>{formatCurrency(food.price)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Quantity</span>
                  <span>{quantity}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Delivery Charge</span>
                  <span className="text-emerald-600 font-black">FREE</span>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="flex justify-between items-end">
                <span className="font-black text-slate-800 text-sm uppercase">Total Amount</span>
                <span className="text-2xl font-black text-rose-600 leading-none">{formatCurrency(food.price * quantity)}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              onClick={handlePlaceOrder}
              disabled={submittingOrder}
              className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest w-full h-12 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25"
            >
              <ShieldCheck className="h-4.5 w-4.5" />
              {submittingOrder ? "Placing Order..." : "Confirm &amp; Place Order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <PublicLayout>
      <Suspense fallback={
        <div className="container mx-auto px-4 py-16 text-center space-y-4 max-w-lg">
          <div className="h-12 w-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold">Setting up checkout...</p>
        </div>
      }>
        <CheckoutContent />
      </Suspense>
    </PublicLayout>
  )
}
