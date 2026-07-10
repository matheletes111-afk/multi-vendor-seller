"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, Plus, MapPin, Check, CreditCard, ShieldAlert, Pencil } from "lucide-react"
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

type CartItem = {
  foodItemId: string
  name: string
  price: number
  quantity: number
  image: string | null
  isVeg: boolean
  category: string
}

type LocalFoodCart = {
  restaurantId: string
  restaurantName: string
  items: CartItem[]
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const foodItemId = searchParams.get("foodItemId")
  const quantityRaw = searchParams.get("quantity")
  const quantity = parseInt(quantityRaw || "1")

  // Checkout source state
  const [isSingleItem, setIsSingleItem] = useState(true)
  const [singleFood, setSingleFood] = useState<FoodItem | null>(null)
  const [cartData, setCartData] = useState<LocalFoodCart | null>(null)
  
  const [loadingFood, setLoadingFood] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")

  // New Address Form State
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
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

  const handleOpenEdit = (addr: Address) => {
    setEditingAddressId(addr.id)
    setFullName(addr.fullName)
    setPhone(addr.phone)
    setAddressLine1(addr.addressLine1)
    setAddressLine2(addr.addressLine2 || "")
    setCity(addr.city)
    setState(addr.state)
    setPostalCode(addr.postalCode)
    setCountry(addr.country)
    setAddressType(addr.addressType)
    setSaveToProfile(true)
    setShowNewForm(true)
  }

  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const fetchFood = async () => {
    if (!foodItemId) return
    try {
      const res = await fetch(`/api/customer/foods/${foodItemId}`)
      const data = await res.json()
      if (data.success) {
        setSingleFood(data.data)
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
    
    // Auth guard redirect
    if (!session) {
      const currentPath = window.location.pathname + window.location.search
      router.push(`/customer/login?callbackUrl=${encodeURIComponent(currentPath)}`)
      return
    }
    if (session.user.role !== "CUSTOMER") {
      router.push("/")
      return
    }

    // Determine checkout source (Query parameter OR LocalStorage cart)
    if (foodItemId) {
      setIsSingleItem(true)
      fetchFood()
    } else {
      setIsSingleItem(false)
      const stored = localStorage.getItem("meeem-food-cart")
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as LocalFoodCart
          if (parsed && parsed.items && parsed.items.length > 0) {
            setCartData(parsed)
          }
        } catch (e) {
          console.error("Error reading food cart from localStorage", e)
        }
      }
      setLoadingFood(false)
    }

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
          const url = editingAddressId
            ? `/api/customer/checkout/addresses/${editingAddressId}`
            : "/api/customer/checkout/addresses"
          const method = editingAddressId ? "PATCH" : "POST"

          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...deliveryDetails, isDefault: !editingAddressId && addresses.length === 0 })
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

      // Gather items and restaurant details based on source
      let restaurantSellerId = ""
      let orderItems: Array<{ foodItemId: string; quantity: number }> = []

      if (isSingleItem) {
        if (!singleFood) {
          setErrorMessage("Single food item details not loaded.")
          setSubmittingOrder(false)
          return
        }
        restaurantSellerId = singleFood.restaurantSellerId
        orderItems = [{ foodItemId: singleFood.id, quantity }]
      } else {
        if (!cartData || cartData.items.length === 0) {
          setErrorMessage("Your cart is empty.")
          setSubmittingOrder(false)
          return
        }
        restaurantSellerId = cartData.restaurantId
        orderItems = cartData.items.map(i => ({
          foodItemId: i.foodItemId,
          quantity: i.quantity
        }))
      }

      // Submit checkout
      const orderRes = await fetch("/api/customer/foods/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSellerId,
          items: orderItems,
          deliveryFullName: deliveryDetails.fullName,
          deliveryPhone: deliveryDetails.phone,
          deliveryAddressLine1: deliveryDetails.addressLine1,
          deliveryAddressLine2: deliveryDetails.addressLine2,
          deliveryCity: deliveryDetails.city,
          deliveryState: deliveryDetails.state,
          deliveryPostalCode: deliveryDetails.postalCode,
          deliveryCountry: deliveryDetails.country,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined
        })
      })

      const orderData = await orderRes.json()
      if (orderData.success) {
        // Clear local food cart if checking out from cart
        if (!isSingleItem) {
          localStorage.removeItem("meeem-food-cart")
        }
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

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const itemsPayload = isSingleItem && singleFood
        ? [{ foodItemId: singleFood.id, price: singleFood.price, quantity }]
        : (cartData ? cartData.items.map(i => ({ foodItemId: i.foodItemId, price: i.price, quantity: i.quantity })) : [])

      const res = await fetch("/api/customer/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          type: "FOOD",
          subtotal: orderSubtotal,
          items: itemsPayload
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAppliedCoupon(data.data)
        setCouponError(null)
      } else {
        setCouponError(data.error || "Failed to apply coupon")
        setAppliedCoupon(null)
      }
    } catch (e) {
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

  if (loadingFood || loadingAddresses) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4 max-w-lg">
        <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-bold">Setting up checkout...</p>
      </div>
    )
  }

  // Calculate order items representation
  const hasItems = isSingleItem ? !!singleFood : (cartData && cartData.items.length > 0)

  if (!hasItems) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-6 max-w-md">
        <ShieldAlert className="h-16 w-16 text-amber-600 mx-auto" />
        <h2 className="text-xl font-black text-slate-800">Checkout Error</h2>
        <p className="text-slate-500">Your basket is empty or the selected item is unavailable.</p>
        <Link href="/foods">
          <Button className="bg-amber-500 text-amber-950 rounded-full font-bold px-6">Return to Menu</Button>
        </Link>
      </div>
    )
  }

  const restaurantName = isSingleItem ? singleFood?.restaurantName : cartData?.restaurantName
  const orderSubtotal = isSingleItem 
    ? (singleFood ? singleFood.price * quantity : 0)
    : (cartData ? cartData.items.reduce((acc, i) => acc + i.price * i.quantity, 0) : 0)
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0

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
              <MapPin className="h-5 w-5 text-amber-600" /> Delivery Address
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
                          ? "border-amber-500 bg-amber-50/10 shadow-sm"
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        selectedAddressId === addr.id
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}>
                        {selectedAddressId === addr.id && <Check className="h-3 w-3" />}
                      </div>

                      <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm">{addr.fullName}</span>
                            <span className="bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                              {addr.addressType}
                            </span>
                            {addr.isDefault && (
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-200">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs mt-1.5 leading-relaxed font-semibold">
                            {addr.addressLine1}, {addr.addressLine2 ? `${addr.addressLine2}, ` : ""}{addr.city}, {addr.state} - {addr.postalCode}, {addr.country}
                          </p>
                          <p className="text-slate-500 text-[11px] font-bold mt-1">Phone: {addr.phone}</p>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-200/50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEdit(addr)
                          }}
                          aria-label="Edit address"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="save_addr" className="text-xs font-bold text-slate-600 cursor-pointer">
                    Save address to my address book for future orders
                  </label>
                </div>

                {addresses.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowNewForm(false)
                      setEditingAddressId(null)
                    }}
                    className="text-xs font-bold text-amber-500 hover:text-amber-600"
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
              <CreditCard className="h-5 w-5 text-amber-600" /> Payment Mode
            </h2>

            <div className="border border-amber-500 bg-amber-50/10 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-amber-950 shrink-0">
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

            {/* Display list of dishes */}
            <div className="space-y-4">
              {isSingleItem && singleFood ? (
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    {(() => {
                      let imageUrl: string | null = null;
                      if (Array.isArray(singleFood.images) && singleFood.images.length > 0) {
                        imageUrl = singleFood.images[0];
                      } else if (singleFood.images && typeof singleFood.images === 'string') {
                        try {
                          const parsed = JSON.parse(singleFood.images);
                          if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                        } catch {}
                      }
                      if (!imageUrl && singleFood.image) {
                        imageUrl = singleFood.image;
                      }
                      return imageUrl ? (
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm shrink-0">
                          <img src={imageUrl} alt={singleFood.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] text-muted-foreground font-bold shrink-0">No Image</div>
                      );
                    })()}
                    <div>
                      <p className="font-bold text-slate-800 line-clamp-2">{singleFood.name}</p>
                      <p className="text-slate-400 text-xs font-bold mt-0.5">By {restaurantName}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-600 shrink-0">x {quantity}</span>
                </div>
              ) : (
                cartData?.items.map(item => (
                  <div key={item.foodItemId} className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-150 flex items-center justify-center text-[10px] text-muted-foreground font-bold shrink-0">No Image</div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-2">{item.name}</p>
                        <p className="text-slate-400 text-[10px] font-bold mt-0.5">{formatCurrency(item.price)} each</p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-600 shrink-0">x {item.quantity}</span>
                  </div>
                ))
              )}

              {/* Coupon Section */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Promo Code</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={couponLoading || !!appliedCoupon}
                    className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                  />
                  {appliedCoupon ? (
                    <Button type="button" variant="outline" onClick={handleRemoveCoupon} className="h-9 text-xs rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50">
                      Remove
                    </Button>
                  ) : (
                    <Button type="button" disabled={couponLoading || !couponCode.trim()} onClick={handleApplyCoupon} className="h-9 text-xs rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold">
                      Apply
                    </Button>
                  )}
                </div>
                {couponError && (
                  <p className="mt-1 text-[11px] text-rose-600 font-semibold">{couponError}</p>
                )}
                {appliedCoupon && (
                  <p className="mt-1 text-[11px] text-emerald-600 font-bold">
                    Saved {formatCurrency(appliedCoupon.discountAmount)}!
                  </p>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(orderSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Delivery Charge</span>
                  <span className="text-emerald-600 font-black">FREE</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600">
                    <span>Coupon Discount ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="flex justify-between items-end">
                <span className="font-black text-slate-800 text-sm uppercase">Total Amount</span>
                <span className="text-2xl font-black text-amber-700 leading-none">{formatCurrency(Math.max(0, orderSubtotal - couponDiscount))}</span>
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
              className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-2xl font-black text-xs uppercase tracking-widest w-full h-12 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 border border-amber-600/10"
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
          <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-bold">Setting up checkout...</p>
        </div>
      }>
        <CheckoutContent />
      </Suspense>
    </PublicLayout>
  )
}
