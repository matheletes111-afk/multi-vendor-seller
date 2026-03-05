"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"

type Seller = {
  id: string
  type: string
  store: { name: string; description: string | null; phone: string | null; website: string | null; address: string | null; city: string | null; state: string | null; zipCode: string | null; country: string | null; logo: string | null; banner: string | null } | null
  user: { email: string; name: string | null; image: string | null }
}

export function SettingsClient() {
  const searchParams = useSearchParams()
  const [seller, setSeller] = useState<Seller | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStore, setSavingStore] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    fetch("/api/product-seller/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSeller)
      .finally(() => setLoading(false))
  }, [])

  const store = seller?.store
  const user = seller?.user
  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")

  async function saveStore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setSavingStore(true)
    await fetch("/api/product-seller/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store: {
          name: fd.get("storeName"),
          description: fd.get("description") || undefined,
          phone: fd.get("phone") || undefined,
          website: fd.get("website") || undefined,
          address: fd.get("address") || undefined,
          city: fd.get("city") || undefined,
          state: fd.get("state") || undefined,
          zipCode: fd.get("zipCode") || undefined,
          country: fd.get("country") || undefined,
          logo: fd.get("logo") || undefined,
          banner: fd.get("banner") || undefined,
        },
      }),
    })
    setSavingStore(false)
  }

  async function saveUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setSavingUser(true)
    await fetch("/api/product-seller/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: { name: fd.get("name") || undefined, image: fd.get("image") || undefined },
      }),
    })
    setSavingUser(false)
  }

  if (loading || !seller) return <PageLoader message="Loading settings…" />

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Store Settings</h1>
      {paramsError && <Alert variant="destructive" className="mb-6"><AlertDescription>{decodeURIComponent(paramsError)}</AlertDescription></Alert>}
      {paramsSuccess && <Alert className="mb-6"><AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription></Alert>}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Store Information</CardTitle><CardDescription>Manage your store details</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveStore} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name *</Label>
                <Input id="storeName" name="storeName" defaultValue={store?.name || ""} placeholder="Enter store name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={store?.description || ""} placeholder="Store description" rows={4} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" defaultValue={store?.phone || ""} placeholder="Phone number" /></div>
                <div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" name="website" type="url" defaultValue={store?.website || ""} placeholder="https://example.com" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={store?.address || ""} placeholder="Street address" /></div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" name="city" defaultValue={store?.city || ""} placeholder="City" /></div>
                <div className="space-y-2"><Label htmlFor="state">State</Label><Input id="state" name="state" defaultValue={store?.state || ""} placeholder="State" /></div>
                <div className="space-y-2"><Label htmlFor="zipCode">Zip Code</Label><Input id="zipCode" name="zipCode" defaultValue={store?.zipCode || ""} placeholder="Zip code" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" defaultValue={store?.country || ""} placeholder="Country" /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="logo">Logo URL</Label><Input id="logo" name="logo" type="url" defaultValue={store?.logo || ""} placeholder="https://example.com/logo.png" /></div>
                <div className="space-y-2"><Label htmlFor="banner">Banner URL</Label><Input id="banner" name="banner" type="url" defaultValue={store?.banner || ""} placeholder="https://example.com/banner.png" /></div>
              </div>
              <Button type="submit" disabled={savingStore}>{savingStore ? "Saving..." : "Save Store Changes"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Account Information</CardTitle><CardDescription>Update your personal information</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email</Label>
                <Input id="userEmail" type="email" defaultValue={user?.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2"><Label htmlFor="userName">Name</Label><Input id="userName" name="name" defaultValue={user?.name || ""} placeholder="Your name" /></div>
              <div className="space-y-2"><Label htmlFor="userImage">Profile Image URL</Label><Input id="userImage" name="image" type="url" defaultValue={user?.image || ""} placeholder="https://example.com/profile.jpg" /></div>
              <div><Label>Seller Type</Label><p className="text-sm text-muted-foreground capitalize">{seller.type.toLowerCase()}</p></div>
              <Button type="submit" disabled={savingUser}>{savingUser ? "Saving..." : "Save Profile Changes"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
