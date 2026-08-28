"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, MapPin, Check, Loader2, Home, Briefcase, Compass, Search, Navigation } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PageLoader } from "@/components/ui/page-loader"
import { GoogleAddressAutocomplete } from "@/components/google-address-autocomplete"
import { GoogleMapView } from "@/components/google-map-view"

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
  latitude: number | null
  longitude: number | null
  isDefault: boolean
}

type AddressFormState = {
  addressType: Address["addressType"]
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
  isDefault: boolean
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
  country: "Sierra Leone",
  latitude: null,
  longitude: null,
  isDefault: false,
}

export function CustomerAddressesClient() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form visibility and edit state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<AddressFormState>(emptyAddressForm)

  const fetchAddresses = async () => {
    try {
      const res = await fetch("/api/customer/checkout/addresses")
      if (res.ok) {
        const data = await res.json()
        setAddresses(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Error fetching addresses:", err)
      setError("Failed to load addresses.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanPhone = formState.phone.trim().replace(/(?!^\+)[^\d]/g, "")
    const digitsOnly = cleanPhone.replace(/\D/g, "")
    if (!digitsOnly || digitsOnly.length < 6 || digitsOnly.length > 15) {
      setError("Phone number must contain between 6 and 15 digits (e.g. +23288123456 or 088994462). Letters, asterisks (*), and symbols are not allowed.")
      return
    }

    if (
      !formState.fullName.trim() ||
      !cleanPhone ||
      !formState.addressLine1.trim() ||
      !formState.city.trim() ||
      !formState.state.trim() ||
      !formState.postalCode.trim() ||
      !formState.country.trim()
    ) {
      setError("Please fill in all required fields.")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      addressType: formState.addressType,
      fullName: formState.fullName.trim(),
      phone: cleanPhone,
      addressLine1: formState.addressLine1.trim(),
      addressLine2: formState.addressLine2.trim() || null,
      city: formState.city.trim(),
      state: formState.state.trim(),
      postalCode: formState.postalCode.trim(),
      country: formState.country.trim(),
      latitude: formState.latitude,
      longitude: formState.longitude,
      isDefault: editingId ? formState.isDefault : addresses.length === 0 || formState.isDefault,
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/customer/checkout/addresses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setError(data?.error || "Failed to update address.")
          return
        }

        setSuccess("Address updated successfully!")
      } else {
        const res = await fetch("/api/customer/checkout/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          setError(data?.error || "Failed to add address.")
          return
        }

        setSuccess("Address added successfully!")
      }

      await fetchAddresses()
      handleCloseForm()
    } catch (err) {
      console.error(err)
      setError("An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/customer/checkout/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        setSuccess("Default address updated.")
        await fetchAddresses()
      } else {
        setError("Failed to update default address.")
      }
    } catch (err) {
      console.error(err)
      setError("An error occurred.")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/customer/checkout/addresses/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setSuccess("Address deleted successfully.")
        await fetchAddresses()
      } else {
        setError("Failed to delete address.")
      }
    } catch (err) {
      console.error(err)
      setError("An error occurred.")
    }
  }

  const handleOpenEdit = (addr: Address) => {
    setEditingId(addr.id)
    setFormState({
      addressType: addr.addressType,
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || "",
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      latitude: addr.latitude ?? null,
      longitude: addr.longitude ?? null,
      isDefault: addr.isDefault,
    })
    setShowForm(true)
    setError(null)
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormState(emptyAddressForm)
    setShowForm(true)
    setError(null)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormState(emptyAddressForm)
  }

  const getAddressIcon = (type: Address["addressType"]) => {
    switch (type) {
      case "HOME":
        return <Home className="h-4 w-4" />
      case "OFFICE":
        return <Briefcase className="h-4 w-4" />
      default:
        return <Compass className="h-4 w-4" />
    }
  }

  if (loading) return <PageLoader message="Loading addresses..." />

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <MapPin className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Delivery Addresses</h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm pl-10">Manage your saved delivery locations with Google Maps integration.</p>
        </div>
        {!showForm && (
          <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4" /> Add New Address
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium animate-in fade-in duration-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-medium animate-in fade-in duration-200">
          {success}
        </div>
      )}

      {showForm ? (
        <Card className="rounded-3xl border-slate-200/80 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-6">
            <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" />
              {editingId ? "Edit Delivery Address" : "Add New Delivery Address"}
            </CardTitle>
            <CardDescription>
              Search with Google Maps or drag the map pin to automatically fill in exact coordinates and address details.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Google Maps Search Box */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
                <Label className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-blue-600" /> Search Address with Google Maps (Auto-fills form & pin)
                </Label>
                <GoogleAddressAutocomplete
                  key={editingId || "new-address-autocomplete"}
                  defaultValue={[formState.addressLine1, formState.city, formState.state].filter(Boolean).join(", ")}
                  onAddressSelect={(parsed) => {
                    setFormState((f) => ({
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
              </div>

              {/* Interactive Map Picker */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-red-500" /> Pinpoint Location on Interactive Map
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Drag pin or click map to update location</span>
                </div>
                <GoogleMapView
                  lat={formState.latitude}
                  lng={formState.longitude}
                  address={[formState.addressLine1, formState.city, formState.state, formState.postalCode].filter(Boolean).join(", ")}
                  title={formState.fullName || "Address Location"}
                  height="260px"
                  draggable
                  onLocationChange={(loc) => {
                    setFormState((f) => ({
                      ...f,
                      latitude: loc.lat,
                      longitude: loc.lng,
                      addressLine1: loc.addressLine1 || f.addressLine1,
                      city: loc.city || f.city,
                      state: loc.state || f.state,
                      postalCode: loc.postalCode || f.postalCode,
                      country: loc.country || f.country,
                    }))
                  }}
                />
              </div>

              {/* Address Type Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label htmlFor="addressType">Address Label</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["HOME", "OFFICE", "OTHER"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormState((f) => ({ ...f, addressType: type }))}
                      className={`py-3 text-xs font-black rounded-2xl border transition-all flex items-center justify-center gap-2 ${
                        formState.addressType === type
                          ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.01]"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {getAddressIcon(type)}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formState.fullName}
                    onChange={(e) => setFormState((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. John Doe"
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={formState.phone}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/(?!^\+)[^\d]/g, "")
                      setFormState((f) => ({ ...f, phone: sanitized }))
                    }}
                    placeholder="e.g. +23288123456"
                    required
                    pattern="^\+?[0-9]{6,15}$"
                    title="Phone number must contain only numbers (6 to 15 digits, optional leading +)."
                    className="rounded-xl border-slate-200"
                  />
                  <p className="text-[11px] text-muted-foreground font-medium">Numbers only (6–15 digits, optional leading +). Letters and symbols like * are automatically blocked.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  value={formState.addressLine1}
                  onChange={(e) => setFormState((f) => ({ ...f, addressLine1: e.target.value }))}
                  placeholder="Street address, building, etc."
                  required
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                <Input
                  id="addressLine2"
                  value={formState.addressLine2}
                  onChange={(e) => setFormState((f) => ({ ...f, addressLine2: e.target.value }))}
                  placeholder="Apartment, suite, unit, floor, etc."
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formState.city}
                    onChange={(e) => setFormState((f) => ({ ...f, city: e.target.value }))}
                    placeholder="City"
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State / Region *</Label>
                  <Input
                    id="state"
                    value={formState.state}
                    onChange={(e) => setFormState((f) => ({ ...f, state: e.target.value }))}
                    placeholder="State"
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal / ZIP Code *</Label>
                  <Input
                    id="postalCode"
                    value={formState.postalCode}
                    onChange={(e) => setFormState((f) => ({ ...f, postalCode: e.target.value }))}
                    placeholder="Postal code"
                    required
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={formState.country}
                  onChange={(e) => setFormState((f) => ({ ...f, country: e.target.value }))}
                  placeholder="Country"
                  required
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formState.isDefault}
                  onChange={(e) => setFormState((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="isDefault" className="cursor-pointer text-xs sm:text-sm font-semibold text-slate-700">
                  Set as default delivery address
                </Label>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={handleCloseForm} className="rounded-xl px-5 font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl min-w-[120px] shadow-lg shadow-blue-600/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Address"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : addresses.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 text-center py-20 bg-slate-50/50">
          <CardContent className="space-y-4 max-w-sm mx-auto">
            <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <MapPin className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-slate-800 text-xl">No saved addresses</p>
              <p className="text-muted-foreground text-sm">Add your primary delivery address with interactive Google Maps picking to speed up checkout.</p>
            </div>
            <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 py-2.5 shadow-lg shadow-blue-600/20">
              <Plus className="h-4 w-4 mr-2" /> Add New Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              className={`rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between hover:shadow-xl ${
                addr.isDefault
                  ? "border-blue-300 ring-2 ring-blue-500/20 bg-white"
                  : "border-slate-200/80 bg-white hover:border-slate-300"
              }`}
            >
              <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900 text-base tracking-tight">{addr.fullName}</span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200">
                        {getAddressIcon(addr.addressType)}
                        {addr.addressType}
                      </span>
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Check className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {addr.addressLine1}
                    {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                    <br />
                    {addr.city}, {addr.state} - {addr.postalCode}
                    <br />
                    <span className="font-bold text-slate-800">{addr.country}</span>
                  </p>
                  <p className="text-slate-500 text-xs font-bold">Phone: {addr.phone}</p>

                  {/* Embedded Google Map Preview for Saved Address */}
                  <div className="pt-2">
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative">
                      <GoogleMapView
                        lat={addr.latitude}
                        lng={addr.longitude}
                        address={`${addr.addressLine1}, ${addr.city}, ${addr.state} ${addr.postalCode}`}
                        title={addr.fullName}
                        height="150px"
                        interactive={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                  <div>
                    {!addr.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 px-3 py-1.5 h-auto rounded-xl"
                      >
                        Set as Default
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(addr)}
                      className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                      aria-label="Edit address"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(addr.id)}
                      className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                      aria-label="Delete address"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
