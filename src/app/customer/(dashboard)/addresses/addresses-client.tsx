"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, MapPin, Check, Star, Loader2, Home, Briefcase, Compass } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PageLoader } from "@/components/ui/page-loader"

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
    if (
      !formState.fullName.trim() ||
      !formState.phone.trim() ||
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
      phone: formState.phone.trim(),
      addressLine1: formState.addressLine1.trim(),
      addressLine2: formState.addressLine2.trim() || null,
      city: formState.city.trim(),
      state: formState.state.trim(),
      postalCode: formState.postalCode.trim(),
      country: formState.country.trim(),
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
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Delivery Addresses</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your saved delivery destinations for seamless checkout.</p>
        </div>
        {!showForm && (
          <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Address
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
          {success}
        </div>
      )}

      {showForm ? (
        <Card className="rounded-2xl border-slate-100 shadow-sm animate-in fade-in duration-300">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Address" : "Add New Address"}</CardTitle>
            <CardDescription>Fill out the fields below. Asterisks (*) indicate required fields.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressType">Address Type</Label>
                <div className="flex gap-2">
                  {(["HOME", "OFFICE", "OTHER"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormState((f) => ({ ...f, addressType: type }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
                        formState.addressType === type
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formState.phone}
                    onChange={(e) => setFormState((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. +232 88 123456"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  value={formState.addressLine1}
                  onChange={(e) => setFormState((f) => ({ ...f, addressLine1: e.target.value }))}
                  placeholder="Street address, company, etc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                <Input
                  id="addressLine2"
                  value={formState.addressLine2}
                  onChange={(e) => setFormState((f) => ({ ...f, addressLine2: e.target.value }))}
                  placeholder="Apartment, suite, unit, floor, etc."
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
                <Label htmlFor="isDefault" className="cursor-pointer text-xs sm:text-sm">Set as default delivery address</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseForm} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl min-w-[100px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : addresses.length === 0 ? (
        <Card className="rounded-2xl border-slate-100 text-center py-16">
          <CardContent className="space-y-4">
            <MapPin className="h-12 w-12 text-slate-350 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-slate-700 text-lg">No addresses saved</p>
              <p className="text-muted-foreground text-sm">Add a delivery address to simplify your checkout experience.</p>
            </div>
            <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
              Add New Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              className={`rounded-2xl border transition-all duration-300 group hover:shadow-md ${
                addr.isDefault ? "border-blue-200 bg-blue-50/10" : "border-slate-100 bg-white"
              }`}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-800 text-sm tracking-tight">{addr.fullName}</span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                        {getAddressIcon(addr.addressType)}
                        {addr.addressType}
                      </span>
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-0.5 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                          <Check className="h-2.5 w-2.5" /> Default
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed font-medium">
                    {addr.addressLine1}
                    {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                    <br />
                    {addr.city}, {addr.state} - {addr.postalCode}
                    <br />
                    {addr.country}
                  </p>
                  <p className="text-slate-500 text-[11px] font-bold">Phone: {addr.phone}</p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <div>
                    {!addr.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 p-0 h-auto"
                      >
                        Set as Default
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(addr)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                      aria-label="Edit address"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(addr.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
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
