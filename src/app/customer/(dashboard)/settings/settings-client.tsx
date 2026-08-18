"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, Scale, Settings as SettingsIcon, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { validatePassword } from "@/lib/password-validation"
import { LegalPolicyTabContent } from "@/components/legal/legal-policy-tab-content"
import { cn } from "@/lib/utils"

type UserProfile = {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  phoneCountryCode: string | null
}

export function CustomerSettingsClient() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"general" | "legal">(() => {
    return searchParams.get("tab") === "legal" ? "legal" : "general"
  })
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)

  useEffect(() => {
    fetch("/api/customer/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const phone = ((fd.get("phone") as string | null) ?? "").trim()
    const phoneCountryCode = ((fd.get("phoneCountryCode") as string | null) ?? "").trim()
    if (!phone || !phoneCountryCode) {
      setError("Phone and country code are required.")
      return
    }
    if (!/^\+?[0-9]+$/.test(phoneCountryCode)) {
      setError("Country code must contain only numbers (optionally starting with +).")
      return
    }
    if (!/^[0-9]+$/.test(phone)) {
      setError("Phone number must contain only numbers.")
      return
    }
    const password = ((fd.get("password") as string) ?? "").trim()
    const confirmPassword = ((fd.get("confirmPassword") as string) ?? "").trim()
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setError("New password and confirm password do not match.")
        return
      }
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        setError(passwordValidation.error || "Weak password")
        return
      }
    }
    const hasFile = fd.get("profileImage") instanceof File && (fd.get("profileImage") as File).size > 0
    setSaving(true)
    let isReloading = false
    try {
      let updateResponse: Response
      if (hasFile) {
        updateResponse = await fetch("/api/customer/settings", { method: "PUT", body: fd })
      } else {
        updateResponse = await fetch("/api/customer/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fd.get("name") || undefined,
            image: (fd.get("image") as string) || undefined,
            phone: (fd.get("phone") as string) ?? "",
            phoneCountryCode: (fd.get("phoneCountryCode") as string) ?? "",
            password: password || undefined,
            currentPassword: (fd.get("currentPassword") as string) || undefined,
          }),
        })
      }
      if (!updateResponse.ok) {
        const payload = await updateResponse.json().catch(() => null) as { error?: string } | null
        setError(payload?.error || "Failed to update profile.")
        return
      }
      const res = await fetch("/api/customer/settings")
      if (res.ok) {
        setUser(await res.json())
        setSuccess("Profile updated successfully! Reloading...")
        isReloading = true
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
      setShowPassword(false)
      setShowConfirmPassword(false)
    } finally {
      if (!isReloading) {
        setSaving(false)
      }
    }
  }

  if (loading || !user) return <PageLoader message="Loading profile…" />

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
      </div>

      {/* Settings Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-8 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "general"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <User className="w-4 h-4" />
          <span>Profile & Security</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("legal")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "legal"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Scale className="w-4 h-4 text-emerald-400" />
          <span>Legal & Policies</span>
        </button>
      </div>

      {activeTab === "legal" ? (
        <LegalPolicyTabContent role="CUSTOMER" />
      ) : (
        <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Update your personal information. Phone and country code are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
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
            <div className="space-y-2">
              <Label>Profile picture</Label>
              <ProfilePictureInput currentImage={user.image} fileInputName="profileImage" urlInputName="image" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name || ""} placeholder="Your name" />
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div className="space-y-2">
                <Label htmlFor="phoneCountryCode">Country code</Label>
                <Input
                  id="phoneCountryCode"
                  name="phoneCountryCode"
                  type="tel"
                  inputMode="numeric"
                  defaultValue={user.phoneCountryCode || ""}
                  placeholder="+1"
                  pattern="^\+?[0-9]+$"
                  title="Country code must contain only numbers (optionally starting with +)."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  defaultValue={user.phone || ""}
                  placeholder="Phone number"
                  pattern="^[0-9]+$"
                  title="Phone number must contain only numbers."
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
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
                <p className="mt-1 text-xs text-gray-500">Must contain uppercase, lowercase, a number, and a special character.</p>
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
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
