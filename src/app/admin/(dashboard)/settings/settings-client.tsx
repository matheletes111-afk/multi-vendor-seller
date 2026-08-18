"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, User, Mail, Phone, Lock, ShieldCheck, Globe, Smartphone, Plus, Trash2, Ban, X, Box, Search, ChevronLeft, ChevronRight, Filter, Scale, Settings as SettingsIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Alert, AlertDescription } from "@/ui/alert"
import { PageLoader } from "@/components/ui/page-loader"
import { ProfilePictureInput } from "@/components/profile-picture-input"
import { LegalPolicyTabContent } from "@/components/legal/legal-policy-tab-content"
import { cn } from "@/lib/utils"

import { LOCATION_ZONES, ALL_LOCATION_REGIONS, getZoneForRegion } from "@/lib/location-zones"

const ALLOWED_ADMINISTRATIVE_REGIONS = ALL_LOCATION_REGIONS

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
    dimensionDeliveryChargeRanges?: {
      minDimension: number
      maxDimension: number
      charge: number
    }[]
    regionDeliveryCharges?: {
      region: string
      charge: number
    }[]
    disallowedNames?: string[]
  }
}

export function AdminSettingsClient() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"general" | "legal">(() => {
    return searchParams.get("tab") === "legal" ? "legal" : "general"
  })
  const [user, setUser] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [ranges, setRanges] = useState<{ minWeight: string; maxWeight: string; charge: string }[]>([])
  const [dimensionRanges, setDimensionRanges] = useState<{ minDimension: string; maxDimension: string; charge: string }[]>([])
  const [regionCharges, setRegionCharges] = useState<{ region: string; charge: string }[]>([])
  const [regionSearchInput, setRegionSearchInput] = useState("")
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("")
  const [selectedZoneFilter, setSelectedZoneFilter] = useState("ALL")
  const [regionPage, setRegionPage] = useState(1)
  const [regionPageSize, setRegionPageSize] = useState(15)
  const [disallowedNames, setDisallowedNames] = useState<string[]>([])
  const [newDisallowedName, setNewDisallowedName] = useState("")

  function handleApplySearch() {
    setAppliedSearchQuery(regionSearchInput.trim().toLowerCase())
    setRegionPage(1)
  }

  function handleClearSearch() {
    setRegionSearchInput("")
    setAppliedSearchQuery("")
    setSelectedZoneFilter("ALL")
    setRegionPage(1)
  }

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
        if (data?.globalSettings?.dimensionDeliveryChargeRanges) {
          const loadedDimRanges = data.globalSettings.dimensionDeliveryChargeRanges.map((r: any) => ({
            minDimension: String(r.minDimension),
            maxDimension: String(r.maxDimension),
            charge: String(r.charge),
          }))
          setDimensionRanges(loadedDimRanges)
        }
        if (data?.globalSettings?.regionDeliveryCharges) {
          const loadedRegCharges = data.globalSettings.regionDeliveryCharges.map((r: any) => ({
            region: String(r.region),
            charge: String(r.charge),
          }))
          setRegionCharges(loadedRegCharges)
        }
        if (data?.globalSettings?.disallowedNames && Array.isArray(data.globalSettings.disallowedNames)) {
          setDisallowedNames(data.globalSettings.disallowedNames)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function handleAddDisallowedName() {
    const trimmed = newDisallowedName.trim().toLowerCase()
    if (!trimmed) return
    if (disallowedNames.includes(trimmed)) {
      setNewDisallowedName("")
      return
    }
    setDisallowedNames((prev) => [...prev, trimmed])
    setNewDisallowedName("")
  }

  function handleRemoveDisallowedName(nameToRemove: string) {
    setDisallowedNames((prev) => prev.filter((n) => n !== nameToRemove))
  }

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

  function addDimensionRange() {
    setDimensionRanges((prev) => {
      let nextMin = "0"
      if (prev.length > 0) {
        const sorted = [...prev].sort((a, b) => parseFloat(a.minDimension || "0") - parseFloat(b.minDimension || "0"))
        const last = sorted[sorted.length - 1]
        nextMin = last.maxDimension || "0"
      }
      return [...prev, { minDimension: nextMin, maxDimension: "", charge: "" }]
    })
  }

  function removeDimensionRange(index: number) {
    setDimensionRanges((prev) => prev.filter((_, i) => i !== index))
  }

  function updateDimensionRange(index: number, key: "minDimension" | "maxDimension" | "charge", value: string) {
    setDimensionRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    )
  }

  function addRegionCharge() {
    const availableRegion = ALLOWED_ADMINISTRATIVE_REGIONS.find(
      (reg) => !regionCharges.some((rc) => rc.region === reg)
    ) || ""
    setRegionCharges((prev) => [{ region: availableRegion, charge: "" }, ...prev])
    setRegionSearchInput("")
    setAppliedSearchQuery("")
    setSelectedZoneFilter("ALL")
    setRegionPage(1)
  }

  function removeRegionCharge(index: number) {
    setRegionCharges((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRegionCharge(index: number, key: "region" | "charge", value: string) {
    if (key === "region" && value && regionCharges.some((r, i) => i !== index && r.region === value)) {
      alert(`"${value}" is already configured. Duplicate regions are not allowed.`)
      return
    }
    setRegionCharges((prev) =>
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

  function validateClientDimensionRanges(
    items: { minDimension: string; maxDimension: string; charge: string }[]
  ): { valid: boolean; error: string | null } {
    if (items.length === 0) return { valid: true, error: null }

    const parsed = []
    for (let i = 0; i < items.length; i++) {
      const min = parseFloat(items[i].minDimension)
      const max = parseFloat(items[i].maxDimension)
      const chg = parseFloat(items[i].charge)

      if (isNaN(min) || min < 0) {
        return { valid: false, error: `Dimension Range ${i + 1}: Minimum dimension/volume must be a non-negative number.` }
      }
      if (isNaN(max) || max <= min) {
        return { valid: false, error: `Dimension Range ${i + 1}: Maximum dimension/volume must be greater than minimum dimension/volume.` }
      }
      if (isNaN(chg) || chg < 0) {
        return { valid: false, error: `Dimension Range ${i + 1}: Delivery charge must be a non-negative number.` }
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
            error: `Range gap or overlap detected between dimension ranges (${prev.min}-${prev.max} cm³) and (${current.min}-${current.max} cm³). The minimum dimension of a range must match the maximum dimension of the previous range.`
          }
        }
      }
    }

    if (parsed[0].min > 0.001) {
      return { valid: false, error: "The first dimension range must start at 0 cm³." }
    }

    return { valid: true, error: null }
  }

  function validateClientRegionCharges(
    items: { region: string; charge: string }[]
  ): { valid: boolean; error: string | null } {
    if (items.length === 0) return { valid: true, error: null }

    const seen = new Set<string>()
    for (let i = 0; i < items.length; i++) {
      const r = items[i].region
      const chg = parseFloat(items[i].charge)
      if (!r) {
        return { valid: false, error: `Row ${i + 1}: Administrative Region is required.` }
      }
      if (seen.has(r)) {
        return { valid: false, error: `Region "${r}" is configured multiple times.` }
      }
      seen.add(r)
      if (isNaN(chg) || chg < 0) {
        return { valid: false, error: `Delivery charge for "${r}" must be a non-negative number.` }
      }
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

    const dimValidation = validateClientDimensionRanges(dimensionRanges)
    if (!dimValidation.valid) {
      setError(dimValidation.error)
      return
    }

    const regValidation = validateClientRegionCharges(regionCharges)
    if (!regValidation.valid) {
      setError(regValidation.error)
      return
    }

    fd.append("deliveryChargeRanges", JSON.stringify(ranges.map(r => ({
      minWeight: parseFloat(r.minWeight),
      maxWeight: parseFloat(r.maxWeight),
      charge: parseFloat(r.charge)
    }))))
    fd.append("dimensionDeliveryChargeRanges", JSON.stringify(dimensionRanges.map(r => ({
      minDimension: parseFloat(r.minDimension),
      maxDimension: parseFloat(r.maxDimension),
      charge: parseFloat(r.charge)
    }))))
    fd.append("regionDeliveryCharges", JSON.stringify(regionCharges.map(rc => ({
      region: rc.region,
      charge: parseFloat(rc.charge)
    }))))
    fd.append("disallowedNames", JSON.stringify(disallowedNames))

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
        body: fd,
      })
      const data = await updateResponse.json().catch(() => ({}))
      if (!updateResponse.ok) {
        throw new Error(data.error || "Failed to update profile")
      }
      setSuccess("Profile settings updated successfully.")
      alert("Profile settings updated successfully!")
      if (data.image) {
        setUser((prev) => (prev ? { ...prev, image: data.image } : prev))
      }
      const profileImageInput = form.querySelector('input[type="file"][name="profileImage"]') as HTMLInputElement | null
      if (profileImageInput && profileImageInput.files && profileImageInput.files.length > 0) {
        isReloading = true
        window.location.reload()
      }
    } catch (err: any) {
      setError(err.message || "Failed to save profile")
    } finally {
      if (!isReloading) {
        setSaving(false)
      }
    }
  }

  if (loading) return <PageLoader message="Loading settings..." />
  if (!user) return <div className="p-8 text-center text-muted-foreground font-medium">Failed to load admin profile.</div>

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Admin System Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage global platform economics, operational security parameters, and profile details.</p>
      </div>

      {/* Settings Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-8 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "general"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>System & Economics</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("legal")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all",
            activeTab === "legal"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          <Scale className="w-4 h-4 text-indigo-400" />
          <span>Legal & Platform Policies</span>
        </button>
      </div>

      {activeTab === "legal" ? (
        <LegalPolicyTabContent role="ADMIN" />
      ) : (
        <>
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
              <AlertDescription className="font-medium text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="rounded-2xl border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
              <AlertDescription className="font-medium text-sm">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={saveProfile}>
        <div className="space-y-8">
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-muted/20">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-medium">Profile Identity</CardTitle>
                  <CardDescription className="pt-1 font-medium italic text-xs uppercase tracking-widest opacity-60">Personal credentials & system authorization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="flex flex-col sm:flex-row items-center gap-8 pb-8 border-b border-muted/30">
                <ProfilePictureInput fileInputName="profileImage" currentImage={user.image} size="lg" />
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-lg font-medium">{user.name || "Administrator"}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                  <Badge variant="outline" className="mt-2 bg-primary/5 text-primary border-primary/20 rounded-full font-medium text-[10px] uppercase tracking-wider px-3 py-0.5">
                    Super Administrator
                  </Badge>
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">System Handle (Email)</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input id="email" value={user.email} disabled className="pl-12 border-muted bg-muted/40 rounded-2xl h-12 text-muted-foreground font-mono text-xs cursor-not-allowed opacity-80" />
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
                    <Input id="phoneCountryCode" name="phoneCountryCode" type="tel" defaultValue={user.phoneCountryCode || ""} placeholder="+234" className="pl-12 border-muted bg-muted/20 rounded-2xl h-12" required />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-1">Secure Line</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input id="phone" name="phone" type="tel" defaultValue={user.phone || ""} placeholder="Telephonic signature" className="pl-12 border-muted bg-muted/20 rounded-2xl h-12" required />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>          {/* Delivery Charges Calculation Logic Explainer Banner */}
          <div className="rounded-[2.5rem] bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 p-8 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
                <Box className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Delivery Charges Calculation Engine</h3>
                <p className="text-xs text-white/80 font-medium mt-0.5">How customer delivery charges are calculated at checkout (Web & Mobile)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-200 block">1. Physical Base Fee</span>
                <p className="text-xs font-semibold leading-relaxed text-white">
                  Takes the <span className="font-bold underline underline-offset-2">HIGHER</span> of Weight charge vs Volume charge:
                </p>
                <code className="text-[11px] font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg block mt-1 text-yellow-300">
                  Math.max(Weight, Volume)
                </code>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-200 block">2. Regional Surcharge</span>
                <p className="text-xs font-semibold leading-relaxed text-white">
                  Flat surcharge based on customer's delivery state/province:
                </p>
                <code className="text-[11px] font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg block mt-1 text-emerald-300">
                  Flat Per-Order Charge
                </code>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-200 block">3. Total Delivery Fee</span>
                <p className="text-xs font-semibold leading-relaxed text-white">
                  Physical Base Fee + Region Fee. Unconfigured values safely default to:
                </p>
                <code className="text-[11px] font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg block mt-1 text-amber-300">
                  NLe 0.00 Default
                </code>
              </div>
            </div>
          </div>

          {/* Weight-based Shipping Rates Card */}
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-primary/5 border-l-4 border-primary">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 col-span-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold">1. Weight-based Shipping Rates</CardTitle>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-[10px]">
                        {ranges.length} Tier{ranges.length === 1 ? "" : "s"} Configured
                      </Badge>
                    </div>
                    <CardDescription className="pt-1 font-medium text-xs text-muted-foreground">
                      Set shipping fee tiers based on total package weight in kilograms (kg).
                    </CardDescription>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRange} className="rounded-full gap-1.5 font-bold uppercase tracking-wider text-[10px] border-primary/30 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> Add Weight Tier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {ranges.length === 0 ? (
                <div className="text-center py-8 bg-muted/10 rounded-3xl border-2 border-dashed border-muted/40 space-y-3">
                  <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-muted-foreground">No weight tiers configured yet.</p>
                  <Button type="button" size="sm" onClick={addRange} className="rounded-full gap-1.5 font-bold text-xs">
                    <Plus className="h-4 w-4" /> Add First Weight Tier
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {ranges.map((range, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-end md:items-center gap-4 bg-muted/10 p-5 rounded-3xl border border-muted/30 hover:border-primary/30 transition-all relative group">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        #{index + 1}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Min Weight</span>
                            <span className="text-primary font-mono text-[9px]">kg</span>
                          </Label>
                          <Input type="number" step="0.001" min="0" placeholder="0.0" value={range.minWeight} onChange={(e) => updateRange(index, "minWeight", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Max Weight</span>
                            <span className="text-primary font-mono text-[9px]">kg</span>
                          </Label>
                          <Input type="number" step="0.001" min="0.001" placeholder="2.0" value={range.maxWeight} onChange={(e) => updateRange(index, "maxWeight", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Delivery Fee</span>
                            <span className="text-emerald-600 font-mono text-[9px]">NLe</span>
                          </Label>
                          <Input type="number" step="0.01" min="0" placeholder="50.00" value={range.charge} onChange={(e) => updateRange(index, "charge", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm text-emerald-700" required />
                        </div>
                      </div>
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeRange(index)} className="rounded-2xl h-11 w-11 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" title="Remove weight tier">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground font-medium italic bg-primary/5 p-3 rounded-2xl border border-primary/10">
                💡 <strong>Tip:</strong> Weight is specified in kilograms (kg) and fee in NLe. Example: Tier 1: <code>0 - 2.0 kg ➔ NLe 50.00</code>, Tier 2: <code>2.0 - 5.0 kg ➔ NLe 100.00</code>.
              </p>
            </CardContent>
          </Card>

          {/* Dimension-based Shipping Rates Card */}
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-indigo-500/5 border-l-4 border-indigo-500">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 col-span-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <Box className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold text-indigo-950">2. Dimension-based Shipping Rates</CardTitle>
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-bold text-[10px]">
                        {dimensionRanges.length} Tier{dimensionRanges.length === 1 ? "" : "s"} Configured
                      </Badge>
                    </div>
                    <CardDescription className="pt-1 font-medium text-xs text-muted-foreground">
                      Set shipping fee tiers based on total volume (Height × Width × Depth in cm³).
                    </CardDescription>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addDimensionRange} className="rounded-full gap-1.5 font-bold uppercase tracking-wider text-[10px] border-indigo-500/30 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> Add Volume Tier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {dimensionRanges.length === 0 ? (
                <div className="text-center py-8 bg-muted/10 rounded-3xl border-2 border-dashed border-muted/40 space-y-3">
                  <Box className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-muted-foreground">No volume tiers configured yet.</p>
                  <Button type="button" size="sm" onClick={addDimensionRange} className="rounded-full gap-1.5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4" /> Add First Volume Tier
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dimensionRanges.map((range, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-end md:items-center gap-4 bg-muted/10 p-5 rounded-3xl border border-muted/30 hover:border-indigo-500/30 transition-all relative group">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-xs shrink-0">
                        #{index + 1}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Min Volume</span>
                            <span className="text-indigo-600 font-mono text-[9px]">cm³</span>
                          </Label>
                          <Input type="number" step="0.1" min="0" placeholder="0.0" value={range.minDimension} onChange={(e) => updateDimensionRange(index, "minDimension", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Max Volume</span>
                            <span className="text-indigo-600 font-mono text-[9px]">cm³</span>
                          </Label>
                          <Input type="number" step="0.1" min="0.1" placeholder="1000.0" value={range.maxDimension} onChange={(e) => updateDimensionRange(index, "maxDimension", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Delivery Fee</span>
                            <span className="text-emerald-600 font-mono text-[9px]">NLe</span>
                          </Label>
                          <Input type="number" step="0.01" min="0" placeholder="50.00" value={range.charge} onChange={(e) => updateDimensionRange(index, "charge", e.target.value)} className="h-11 border-muted bg-background rounded-2xl font-bold text-sm text-emerald-700" required />
                        </div>
                      </div>
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeDimensionRange(index)} className="rounded-2xl h-11 w-11 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" title="Remove volume tier">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground font-medium italic bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10">
                💡 <strong>Volume Calculation:</strong> Volume (cm³) = Height (cm) × Width (cm) × Depth (cm). Example: A package 10 × 10 × 10 cm = 1,000 cm³.
              </p>
            </CardContent>
          </Card>

          {/* Region-wise Delivery Charges Card (Paginated by 15 Zones & Provinces) */}
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-teal-500/5 border-l-4 border-teal-500">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 col-span-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-500/10 rounded-2xl">
                    <Globe className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold text-teal-950">3. Zone & Region-wise Delivery Charges</CardTitle>
                      <Badge variant="outline" className="bg-teal-500/10 text-teal-700 border-teal-500/20 font-bold text-[10px]">
                        {regionCharges.length} Configured ({LOCATION_ZONES.length} Zones)
                      </Badge>
                    </div>
                    <CardDescription className="pt-1 font-medium text-xs text-muted-foreground">
                      Manage delivery charges by Zone & Region (ZONE 1 – ZONE 15, Provinces & Fallback). Fast paginated view.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRegionCharge}
                    className="rounded-full gap-1.5 font-bold uppercase tracking-wider text-[10px] border-teal-500/30 text-teal-700 hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Add Region (At Top)
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Search & Zone Filter Bar with Search Button */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-muted/30">
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search region name or zone..."
                      value={regionSearchInput}
                      onChange={(e) => setRegionSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleApplySearch()
                        }
                      }}
                      className="h-10 pl-9 pr-8 rounded-xl border-muted bg-background text-xs font-semibold"
                    />
                    {regionSearchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setRegionSearchInput("")
                          setAppliedSearchQuery("")
                          setRegionPage(1)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleApplySearch}
                    className="h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 shrink-0"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Zone Filter */}
                  <div className="flex items-center gap-1 bg-background border border-muted rounded-xl px-2.5 h-10">
                    <Filter className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <select
                      value={selectedZoneFilter}
                      onChange={(e) => {
                        setSelectedZoneFilter(e.target.value)
                        setRegionPage(1)
                      }}
                      className="h-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="ALL">All Zones ({LOCATION_ZONES.length})</option>
                      {LOCATION_ZONES.map((z) => (
                        <option key={z.zone} value={z.zone}>
                          {z.zone} ({z.regions.length})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Page Size Selector */}
                  <select
                    value={regionPageSize}
                    onChange={(e) => {
                      setRegionPageSize(Number(e.target.value))
                      setRegionPage(1)
                    }}
                    className="h-10 border border-muted bg-background rounded-xl text-xs font-bold px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={10}>10 / page</option>
                    <option value={15}>15 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                    <option value={9999}>All</option>
                  </select>

                  {(appliedSearchQuery || selectedZoneFilter !== "ALL") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSearch}
                      className="h-10 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Filtering & Pagination Calculation */}
              {(() => {
                const filtered = regionCharges
                  .map((rc, origIdx) => ({ ...rc, origIdx, zone: getZoneForRegion(rc.region) }))
                  .filter((rc) => {
                    if (selectedZoneFilter !== "ALL" && rc.zone !== selectedZoneFilter) return false
                    if (appliedSearchQuery) {
                      const regMatch = rc.region.toLowerCase().includes(appliedSearchQuery)
                      const zoneMatch = rc.zone.toLowerCase().includes(appliedSearchQuery)
                      if (!regMatch && !zoneMatch) return false
                    }
                    return true
                  })

                const totalFiltered = filtered.length
                const totalPages = Math.max(1, Math.ceil(totalFiltered / regionPageSize))
                const safePage = Math.min(Math.max(1, regionPage), totalPages)
                const startIndex = (safePage - 1) * regionPageSize
                const endIndex = Math.min(startIndex + regionPageSize, totalFiltered)
                const paginated = filtered.slice(startIndex, endIndex)

                // Pre-compute a Set of all regions already in use — O(n) once, then O(1) lookups per option
                // This avoids the previous O(n²) .some() call inside every dropdown option render
                const usedRegionsSet = new Set(regionCharges.map((rc) => rc.region))

                return (
                  <div className="space-y-4">
                    {/* Pagination Header Info & Navigation */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-teal-500/10 text-teal-800 border-teal-500/20 font-extrabold text-[11px] px-3 py-1">
                          Showing {totalFiltered > 0 ? startIndex + 1 : 0}–{endIndex} of {totalFiltered} Regions
                          {totalFiltered !== regionCharges.length ? ` (Filtered from ${regionCharges.length})` : ""}
                        </Badge>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage <= 1}
                            onClick={() => setRegionPage((p) => Math.max(1, p - 1))}
                            className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" /> Prev
                          </Button>
                          <span className="text-xs font-extrabold text-slate-700 px-2">
                            Page {safePage} of {totalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage >= totalPages}
                            onClick={() => setRegionPage((p) => Math.min(totalPages, p + 1))}
                            className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1"
                          >
                            Next <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Paginated Cards Grid */}
                    {totalFiltered === 0 ? (
                      <div className="text-center py-8 bg-muted/10 rounded-3xl border-2 border-dashed border-muted/40 space-y-3">
                        <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm font-semibold text-muted-foreground">
                          {regionCharges.length === 0 ? "No regional charges configured yet." : "No regions match your search or filter."}
                        </p>
                        {regionCharges.length > 0 && (
                          <Button type="button" size="sm" onClick={handleClearSearch} variant="outline" className="rounded-full text-xs font-bold">
                            Reset Search & Filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paginated.map((rc) => (
                          <div
                            key={rc.origIdx}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-muted/10 p-3.5 rounded-2xl border border-muted/30 hover:border-teal-500/30 transition-all relative group"
                          >
                            <div className="flex items-center gap-2 shrink-0 sm:w-44">
                              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-teal-500/10 text-teal-700 font-bold text-xs shrink-0">
                                📍
                              </div>
                              {rc.region ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-teal-500/15 text-teal-900 border border-teal-500/30 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full truncate max-w-[130px]"
                                  title={rc.zone}
                                >
                                  {rc.zone}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-teal-600 border-teal-500/30 font-bold">
                                  ✨ New Top Row
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                              <div>
                                <select
                                  value={rc.region}
                                  onChange={(e) => updateRegionCharge(rc.origIdx, "region", e.target.value)}
                                  className="h-10 w-full border border-muted bg-background rounded-xl font-bold text-xs px-3 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                                  required
                                >
                                  <option value="" disabled>
                                    Select Region...
                                  </option>
                                  {LOCATION_ZONES.map((zDef) => (
                                    <optgroup key={zDef.zone} label={`── ${zDef.zone} ──`}>
                                      {zDef.regions.map((reg) => {
                                        // O(1) Set lookup — was previously O(n) .some() per option causing render lag
                                        const isUsed = reg !== rc.region && usedRegionsSet.has(reg)
                                        return (
                                          <option
                                            key={`${zDef.zone}_${reg}`}
                                            value={reg}
                                            disabled={isUsed}
                                          >
                                            {reg} {isUsed ? "(Already Added)" : ""}
                                          </option>
                                        )
                                      })}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>

                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-emerald-600 font-mono text-xs font-bold">NLe</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="50.00"
                                  value={rc.charge}
                                  onChange={(e) => updateRegionCharge(rc.origIdx, "charge", e.target.value)}
                                  className="h-10 pl-11 border-muted bg-background rounded-xl font-bold text-xs text-emerald-700"
                                  required
                                />
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => removeRegionCharge(rc.origIdx)}
                              className="rounded-xl h-10 w-10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                              title="Remove region charge"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom Pagination Bar */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-muted/30">
                        <p className="text-xs text-muted-foreground font-medium">
                          Showing {startIndex + 1} to {endIndex} of {totalFiltered} entries
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage <= 1}
                            onClick={() => setRegionPage(1)}
                            className="h-8 px-2 rounded-lg text-xs font-bold"
                          >
                            « First
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage <= 1}
                            onClick={() => setRegionPage((p) => Math.max(1, p - 1))}
                            className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" /> Prev
                          </Button>
                          <span className="text-xs font-extrabold text-slate-700 px-3">
                            {safePage} / {totalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage >= totalPages}
                            onClick={() => setRegionPage((p) => Math.min(totalPages, p + 1))}
                            className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1"
                          >
                            Next <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={safePage >= totalPages}
                            onClick={() => setRegionPage(totalPages)}
                            className="h-8 px-2 rounded-lg text-xs font-bold"
                          >
                            Last »
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <p className="text-[10px] text-muted-foreground font-medium italic bg-teal-500/5 p-3 rounded-2xl border border-teal-500/10">
                💡 <strong>Instant Paginated Management:</strong> Search by region or zone name and click <strong>Search</strong>. Pagination renders items fast without UI lag. Clicking &quot;+ Add Region&quot; creates a new row at the <strong>TOP</strong> of Page 1.
              </p>
            </CardContent>
          </Card>

          {/* Restricted & Prohibited Names Card */}
          <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-background via-background to-rose-500/5 border-l-4 border-rose-500">
            <CardHeader className="pb-6 border-b border-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 col-span-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-2xl">
                    <Ban className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-bold text-rose-950">4. Restricted & Prohibited Names</CardTitle>
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/20 font-bold text-[10px]">
                        {disallowedNames.length} Term{disallowedNames.length === 1 ? "" : "s"} Restricted
                      </Badge>
                    </div>
                    <CardDescription className="pt-1 font-medium text-xs text-muted-foreground">
                      Block reserved handles, offensive words, or impersonation terms from user & seller registrations.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Ban className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    type="text"
                    placeholder="Enter restricted term (e.g. admin, null, support)..."
                    value={newDisallowedName}
                    onChange={(e) => setNewDisallowedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddDisallowedName()
                      }
                    }}
                    className="pl-12 h-12 border-muted bg-background rounded-2xl font-medium text-sm focus-visible:ring-rose-500"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddDisallowedName}
                  disabled={!newDisallowedName.trim()}
                  className="rounded-2xl h-12 px-6 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-md shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Restricted Name
                </Button>
              </div>

              {disallowedNames.length === 0 ? (
                <div className="text-center py-8 bg-muted/10 rounded-3xl border-2 border-dashed border-muted/40 space-y-3">
                  <Ban className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-muted-foreground">No restricted names configured yet.</p>
                  <p className="text-xs text-muted-foreground/70">Users can register with any name until terms are added to the list above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Active Restricted Terms ({disallowedNames.length})
                  </Label>
                  <div className="flex flex-wrap gap-2.5 p-4 rounded-3xl bg-muted/10 border border-muted/30 min-h-[80px] items-center">
                    {disallowedNames.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/20 rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2 group transition-all"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDisallowedName(name)}
                          className="rounded-full p-0.5 hover:bg-rose-500/20 text-rose-700/70 hover:text-rose-700 transition-colors"
                          title={`Remove ${name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground font-medium italic bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 leading-relaxed">
                🛡️ <strong>Smart Obfuscation Matching:</strong> The validation engine automatically normalizes characters (e.g. <code>@</code> ➔ <code>a</code>, <code>0</code> ➔ <code>o</code>, <code>3</code> ➔ <code>e</code>, <code>$</code>/<code>5</code> ➔ <code>s</code>) to catch bypassed or obfuscated words during Customer and Seller registration.
              </p>
            </CardContent>
          </Card>

          <div className="sticky bottom-6 z-20 flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-[2.5rem] bg-background/95 backdrop-blur-xl border border-muted/30 shadow-2xl">
            <p className="text-xs font-semibold text-muted-foreground max-w-sm">
              💡 Changes applied here will update shipping rules instantly for all Web and Mobile checkouts.
            </p>
            <Button type="submit" disabled={saving} className="w-full sm:w-fit rounded-full px-10 h-14 font-extrabold uppercase tracking-wider text-xs shadow-2xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all gap-2">
              {saving ? (
                <>
                  <PageLoader message="" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Save All System Settings</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      </>
      )}
    </div>
  )
}
