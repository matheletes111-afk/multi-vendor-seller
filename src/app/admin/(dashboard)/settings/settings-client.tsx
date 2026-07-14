"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, User, Mail, Phone, Lock, ShieldCheck, Globe, Smartphone, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"

type AdminProfile = {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  phoneCountryCode: string | null
  globalSettings?: {
    id: string
    baseCommission: number
    deliveryChargeRanges?: {
      minWeight: number
      maxWeight: number
      charge: number
    }[]
  }
}

export function AdminSettingsClient() {
  const [user, setUser] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [ranges, setRanges] = useState<{ minWeight: string; maxWeight: string; charge: string }[]>([])

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data)
        if (data?.globalSettings?.deliveryChargeRanges) {
          const loadedRanges = data.globalSettings.deliveryChargeRanges.map((r: any) => ({
            minWeight: String(r.minWeight),
            maxWeight: String(r.maxWeight),
            charge: String(r.charge),
          }))
          setRanges(loadedRanges)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function addRange() {
    setRanges((prev) => {
      let nextMin = "0"
      if (prev.length > 0) {
        const sorted = [...prev].sort((a, b) => parseFloat(a.minWeight || "0") - parseFloat(b.minWeight || "0"))
        const last = sorted[sorted.length - 1]
        nextMin = last.maxWeight || "0"
      }
      return [...prev, { minWeight: nextMin, maxWeight: "", charge: "" }]
    })
  }

  function removeRange(index: number) {
    setRanges((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRange(index: number, key: "minWeight" | "maxWeight" | "charge", value: string) {
    setRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    )
  }

  function validateClientRanges(
    items: { minWeight: string; maxWeight: string; charge: string }[]
  ): { valid: boolean; error: string | null } {
    if (items.length === 0) return { valid: true, error: null }

    const parsed = []
    for (let i = 0; i < items.length; i++) {
      const min = parseFloat(items[i].minWeight)
      const max = parseFloat(items[i].maxWeight)
      const chg = parseFloat(items[i].charge)

      if (isNaN(min) || min < 0) {
        return { valid: false, error: `Range ${i + 1}: Minimum weight must be a non-negative number.` }
      }
      if (isNaN(max) || max <= min) {
        return { valid: false, error: `Range ${i + 1}: Maximum weight must be greater than minimum weight.` }
      }
      if (isNaN(chg) || chg < 0) {
        return { valid: false, error: `Range ${i + 1}: Delivery charge must be a non-negative number.` }
      }
      parsed.push({ min, max, chg })
    }

    parsed.sort((a, b) => a.min - b.min)

    for (let i = 0; i < parsed.length; i++) {
      const current = parsed[i]
      if (i > 0) {
        const prev = parsed[i - 1]
        if (Math.abs(current.min - prev.max) > 0.001) {
          return {
            valid: false,
            error: `Range gap or overlap detected between ranges (${prev.min}-${prev.max} kg) and (${current.min}-${current.max} kg). The minimum weight of a range must match the maximum weight of the previous range.`
          }
        }
      }
    }

    if (parsed[0].min > 0.001) {
      return { valid: false, error: "The first range must start at 0 kg." }
    }

    return { valid: true, error: null }
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const form = e.currentTarget
    const fd = new FormData(form)

    const validation = validateClientRanges(ranges)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    fd.append("deliveryChargeRanges", JSON.stringify(ranges.map(r => ({
      minWeight: parseFloat(r.minWeight),
      maxWeight: parseFloat(r.maxWeight),
      charge: parseFloat(r.charge)
    }))))

    // Ensure baseCommission is added to body for JSON or FormData
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

    setSaving(true)
    let isReloading = false
    try {
      const updateResponse = await fetch("/api/admin/settings", {
        method: "PUT",
        body: fd
      })
      if (!updateResponse.ok) {
        const payload = await updateResponse.json().catch(() => null) as { error?: string } | null
        setError(payload?.error || "Failed to update profile.")
        return
      }
      const res = await fetch("/api/admin/settings")
      if (res.ok) {
        setUser(await res.json())
        setSuccess("Profile settings synchronized successfully! Reloading...")
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

  if (loading || !user) return <PageLoader message="Decrypting profile data..." />

  return (
    <div className="container mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Security & Settings</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Manage your administrative credentials and biometric profile</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium rounded-full shadow-sm bg-background border-primary/20 text-primary">
            Master Admin Access
          </Badge>
        </div>
      </div>

      {/* Right Columns: Core Credentials & Platform Settings */}
      <form onSubmit={saveProfile} className="lg:col-span-3 grid gap-8 lg:grid-cols-3">
        {/* Left Column: Visual Profile */}
        <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-muted/20 lg:h-fit">
          <CardHeader className="pb-6 border-b border-muted/30 bg-muted/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <User className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-medium">Visual Identity</CardTitle>
            </div>
            <CardDescription className="pt-1 font-medium italic text-xs uppercase tracking-widest opacity-60">Authentication Avatar</CardDescription>
          </CardHeader>
          <CardContent className="pt-10 pb-12 flex flex-col items-center">
            <div className="relative group cursor-pointer ring-8 ring-primary/5 rounded-full ring-offset-4 ring-offset-background p-1 bg-background shadow-2xl transition-all hover:scale-105 duration-500">
              <ProfilePictureInput currentImage={user.image} fileInputName="profileImage" urlInputName="image" />
            </div>
            <div className="mt-8 text-center space-y-2">
              <h3 className="text-2xl font-medium">{user.name || "System Operator"}</h3>
              <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-muted/50 rounded-full border border-muted w-fit mx-auto">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Identity Verified</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-muted/20">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                  <Lock className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle className="text-xl font-medium">Master Credentials</CardTitle>
              </div>
              <CardDescription className="pt-1 font-medium italic text-xs uppercase tracking-widest opacity-60">System Security Parameters</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              {error && (
                <Alert variant="destructive" className="border-none shadow-xl bg-destructive/10 text-destructive animate-in slide-in-from-top-4 duration-500">
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-none shadow-xl bg-green-500/10 text-green-600 animate-in slide-in-from-top-4 duration-500">
                  <AlertDescription className="font-medium text-xs">Update phase: {success}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">System Handle</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input id="email" type="email" defaultValue={user.email} disabled className="pl-12 bg-muted/40 border-muted rounded-2xl h-12 font-medium cursor-not-allowed opacity-60" />
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 ml-1 italic">* Primary authentication channel (locked)</p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Display Designation</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input id="name" name="name" defaultValue={user.name || ""} placeholder="Operator designation" className="pl-12 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="phoneCountryCode" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Global Prefix</Label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="phoneCountryCode"
                      name="phoneCountryCode"
                      type="tel"
                      inputMode="numeric"
                      defaultValue={user.phoneCountryCode || ""}
                      placeholder="+234"
                      className="pl-12 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Secure Line</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      defaultValue={user.phone || ""}
                      placeholder="Telephonic signature"
                      className="pl-12 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-muted/30">
                <div className="flex items-center gap-3 mb-8">
                  <ShieldCheck className="h-4 w-4 text-orange-500" />
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/60">Cryptographic Update</h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="currentPassword" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Current Password (Required for password change)</Label>
                    <div className="relative max-w-md">
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        className="pr-12 pl-4 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCurrentPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                        aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="password" title="Leave empty to keep current password" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">New Hash Secret</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 6 characters required"
                          className="pr-12 pl-4 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                          aria-label={showPassword ? "Hide new password" : "Show new password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="confirmPassword" title="Leave empty to keep current password" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Verify Hash</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repeat secret for parity"
                          className="pr-12 pl-4 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-primary font-medium shadow-inner"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-amber-500/5 border-l-4 border-amber-500">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <Globe className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-xl font-medium text-amber-900">Platform Configuration</CardTitle>
              </div>
              <CardDescription className="pt-1 font-medium italic text-xs uppercase tracking-widest opacity-60">Global economic parameters</CardDescription>
            </CardHeader>
            <CardContent className="p-10">
              <div className="space-y-3">
                <Label htmlFor="baseCommission" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Platform Base Commission (%)</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 font-medium px-4">%</div>
                  <Input
                    id="baseCommission"
                    name="baseCommission"
                    type="number"
                    step="0.1"
                    defaultValue={user.globalSettings?.baseCommission ?? 10.0}
                    className="pl-12 border-muted bg-muted/20 rounded-2xl h-12 focus-visible:ring-amber-500 font-medium shadow-inner"
                  />
                </div>
                <p className="text-[9px] text-muted-foreground/60 ml-1 italic">* Applied to all sellers unless overridden individually.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-primary/5 border-l-4 border-primary">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex items-center justify-between col-span-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-medium">Weight-based Shipping Rates</CardTitle>
                    <CardDescription className="pt-1 font-medium italic text-xs uppercase tracking-widest opacity-60">Delivery Charges based on weight range (NLE)</CardDescription>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRange} className="rounded-full gap-1.5 font-bold uppercase tracking-wider text-[10px] border-primary/30 text-primary">
                  <Plus className="h-3 w-3" /> Add Range
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              {ranges.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4 bg-muted/10 rounded-2xl w-full">
                  No weight ranges configured. Standard free shipping will apply. Click "Add Range" to set weight-based charges.
                </p>
              ) : (
                <div className="space-y-4">
                  {ranges.map((range, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-end md:items-center gap-4 bg-muted/5 p-4 rounded-2xl border border-muted/20 relative">
                      <div className="grid grid-cols-3 gap-4 flex-1 w-full">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Min Weight (kg)</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.0"
                            value={range.minWeight}
                            onChange={(e) => updateRange(index, "minWeight", e.target.value)}
                            className="h-10 border-muted bg-background rounded-xl font-medium text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Max Weight (kg)</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="2.0"
                            value={range.maxWeight}
                            onChange={(e) => updateRange(index, "maxWeight", e.target.value)}
                            className="h-10 border-muted bg-background rounded-xl font-medium text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Charge (NLE)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="50.00"
                            value={range.charge}
                            onChange={(e) => updateRange(index, "charge", e.target.value)}
                            className="h-10 border-muted bg-background rounded-xl font-medium text-sm"
                            required
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeRange(index)}
                        className="rounded-xl h-10 w-10 shrink-0"
                        title="Remove range"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] text-muted-foreground/60 italic">
                * Specify weights in kilograms (kg) and charges in NLE. Ranges must be continuous (e.g. 0-2kg, 2-5kg) without gaps or overlaps.
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4">
            <p className="text-[10px] font-medium text-muted-foreground/60 italic max-w-sm">
              System configuration updates are logged. Ensure cryptographic parity before submitting changes.
            </p>
            <Button type="submit" disabled={saving} className="w-full sm:w-fit rounded-full px-12 h-14 font-medium uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-primary/30 hover:scale-105 transition-all">
              {saving ? "Synchronizing..." : "Synchronize System"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
