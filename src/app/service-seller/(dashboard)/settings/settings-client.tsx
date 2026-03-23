"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"

type Seller = {
  id: string
  type: string
  isApproved?: boolean
  isSuspended?: boolean
  nationIdentityNumber?: string | null
  store: { name: string; description: string | null; phone: string | null; website: string | null; address: string | null; city: string | null; state: string | null; zipCode: string | null; country: string | null; logo: string | null; banner: string | null } | null
  user: { email: string; name: string | null; image: string | null; phone: string | null; phoneCountryCode: string | null }
}

export function ServiceSettingsClient() {
  const searchParams = useSearchParams()
  const [seller, setSeller] = useState<Seller | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStore, setSavingStore] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  useEffect(() => {
    fetch("/api/service-seller/settings").then((r) => (r.ok ? r.json() : null)).then(setSeller).finally(() => setLoading(false))
  }, [])
  const store = seller?.store
  const user = seller?.user
  const paramsError = searchParams.get("error")
  const paramsSuccess = searchParams.get("success")
  const sellerPendingApproval = seller?.isApproved === false
  const identityMissing = !seller?.nationIdentityNumber || seller.nationIdentityNumber.trim().length === 0
  const showParamsError = paramsError && paramsError !== "AccountPendingApproval"
  async function saveStore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setSavingStore(true)
    await fetch("/api/service-seller/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store: { name: fd.get("storeName"), description: fd.get("description") || undefined, phone: fd.get("phone") || undefined, website: fd.get("website") || undefined, address: fd.get("address") || undefined, city: fd.get("city") || undefined, state: fd.get("state") || undefined, zipCode: fd.get("zipCode") || undefined, country: fd.get("country") || undefined, logo: fd.get("logo") || undefined, banner: fd.get("banner") || undefined } }) })
    setSavingStore(false)
  }
  async function saveUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const password = ((fd.get("password") as string | null) ?? "").trim()
    const confirmPassword = ((fd.get("confirmPassword") as string | null) ?? "").trim()
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setError("New password and confirm password do not match.")
        return
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.")
        return
      }
    }
    const hasFile = fd.get("profileImage") instanceof File && (fd.get("profileImage") as File).size > 0
    setSavingUser(true)
    try {
      let updateResponse: Response
      if (hasFile) {
        updateResponse = await fetch("/api/service-seller/settings", { method: "PUT", body: fd })
      } else {
        const nidRaw = fd.get("nationIdentityNumber") as string | null
        const nationIdentityNumber = (nidRaw ?? "").trim()
        updateResponse = await fetch("/api/service-seller/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: {
              name: fd.get("name") || undefined,
              image: fd.get("image") || undefined,
              phone: (fd.get("phone") as string) ?? "",
              phoneCountryCode: (fd.get("phoneCountryCode") as string) ?? "",
              password: password || undefined,
            },
            seller: { nationIdentityNumber: nationIdentityNumber || null },
          }),
        })
      }
      if (!updateResponse.ok) {
        const payload = await updateResponse.json().catch(() => null) as { error?: string } | null
        setError(payload?.error || "Failed to update profile.")
        return
      }
      const res = await fetch("/api/service-seller/settings")
      if (res.ok) {
        setSeller(await res.json())
        setSuccess("Profile updated")
      }
      setShowPassword(false)
      setShowConfirmPassword(false)
    } finally {
      setSavingUser(false)
    }
  }
  if (loading || !seller) return <PageLoader message="Loading settings…" />
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Store Settings</h1>
      {sellerPendingApproval && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="space-y-1">
            <div className="font-semibold">Admin approval required</div>
            <div>
              {identityMissing
                ? "Please complete your profile by entering your Nation Identity Number below. The admin needs this to approve your seller account."
                : "Your seller account is pending admin approval. Your profile details have been submitted—please wait for the admin to review and approve."}
            </div>
          </AlertDescription>
        </Alert>
      )}
      {showParamsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{decodeURIComponent(paramsError as string)}</AlertDescription>
        </Alert>
      )}
      {paramsSuccess && <Alert className="mb-6"><AlertDescription>{decodeURIComponent(paramsSuccess)}</AlertDescription></Alert>}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Store Information</CardTitle><CardDescription>Manage your store details</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveStore} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="storeName">Store Name *</Label><Input id="storeName" name="storeName" defaultValue={store?.name || ""} placeholder="Enter store name" required /></div>
              <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={store?.description || ""} placeholder="Store description" rows={4} /></div>
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
          <CardHeader><CardTitle>Account Information</CardTitle><CardDescription>Update your personal information. New password is optional.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveUser} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {success}
                </div>
              )}
              <div className="space-y-2"><Label htmlFor="userEmail">Email</Label><Input id="userEmail" type="email" defaultValue={user?.email} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">Email cannot be changed</p></div>
              <div className="space-y-2"><Label htmlFor="userName">Name</Label><Input id="userName" name="name" defaultValue={user?.name || ""} placeholder="Your name" /></div>
              <div className="space-y-2">
                <Label htmlFor="nationIdentityNumber">Nation Identity Number</Label>
                <Input
                  id="nationIdentityNumber"
                  name="nationIdentityNumber"
                  defaultValue={seller?.nationIdentityNumber ?? ""}
                  placeholder="Enter nation identity number"
                  required={sellerPendingApproval && identityMissing}
                />
                <p
                  className={`text-xs ${
                    sellerPendingApproval ? (identityMissing ? "text-destructive" : "text-muted-foreground") : "text-muted-foreground"
                  }`}
                >
                  {sellerPendingApproval && identityMissing ? "Required for admin approval." : "Used by admin to verify your seller profile."}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <div className="space-y-2">
                  <Label htmlFor="userPhoneCountryCode">Country code</Label>
                  <Input
                    id="userPhoneCountryCode"
                    name="phoneCountryCode"
                    type="tel"
                    inputMode="numeric"
                    defaultValue={user?.phoneCountryCode || ""}
                    placeholder="+1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userPhone">Phone</Label>
                  <Input
                    id="userPhone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    defaultValue={user?.phone || ""}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? "Hide new password" : "Show new password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave password fields empty if you do not want to change your password.
              </p>
              <div className="space-y-2"><Label>Profile picture</Label><ProfilePictureInput currentImage={user?.image} fileInputName="profileImage" urlInputName="image" /></div>
              <div><Label>Seller Type</Label><p className="text-sm text-muted-foreground capitalize">{seller.type.toLowerCase()}</p></div>
              <Button type="submit" disabled={savingUser}>{savingUser ? "Saving..." : "Save Profile Changes"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
