"use client"

import { useEffect, useState } from "react"
import {
  Smartphone,
  Apple,
  Users,
  Store,
  Bike,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Save,
  RotateCcw,
  Check,
  ShieldAlert,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Switch } from "@/ui/switch"
import { Alert, AlertDescription } from "@/ui/alert"
import { cn } from "@/lib/utils"
import {
  AppType,
  PlatformType,
  AppVersionConfig,
  DEFAULT_APP_CONFIGS,
  getConfigKey,
} from "@/lib/app-versions"

export function AppUpdateSettingsTab() {
  const [selectedApp, setSelectedApp] = useState<AppType>("customer")
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>("android")

  const [configs, setConfigs] = useState<Record<string, AppVersionConfig>>(DEFAULT_APP_CONFIGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const currentKey = getConfigKey(selectedApp, selectedPlatform)
  const activeConfig = configs[currentKey] || DEFAULT_APP_CONFIGS[currentKey]

  // Form draft state for currently active config
  const [draft, setDraft] = useState<AppVersionConfig>(activeConfig)
  const [releaseNotesText, setReleaseNotesText] = useState("")

  // Fetch configs on load
  useEffect(() => {
    fetchConfigs()
  }, [])

  async function fetchConfigs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/app-versions")
      if (res.ok) {
        const json = await res.json()
        if (json?.data) {
          setConfigs(json.data)
        }
      } else {
        setError("Failed to fetch app version configurations.")
      }
    } catch (err) {
      console.error("Error loading app version configs:", err)
      setError("An unexpected error occurred while loading app versions.")
    } finally {
      setLoading(false)
    }
  }

  // Update draft whenever tab or config map changes
  useEffect(() => {
    const cfg = configs[currentKey] || DEFAULT_APP_CONFIGS[currentKey]
    setDraft(cfg)
    setReleaseNotesText(Array.isArray(cfg.releaseNotes) ? cfg.releaseNotes.join("\n") : "")
    setSuccess(null)
    setError(null)
  }, [currentKey, configs])

  function handleDraftChange<K extends keyof AppVersionConfig>(key: K, value: AppVersionConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleReleaseNotesChange(text: string) {
    setReleaseNotesText(text)
    const lines = text
      .split("\n")
      .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean)
    handleDraftChange("releaseNotes", lines)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/app-versions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setConfigs((prev) => ({
          ...prev,
          [currentKey]: json.data || draft,
        }))
        setSuccess(`Update settings for ${draft.app.toUpperCase()} (${draft.platform.toUpperCase()}) saved successfully!`)
      } else {
        setError(json?.error || "Failed to save app version configuration.")
      }
    } catch (err) {
      console.error("Error saving app version config:", err)
      setError("An error occurred while saving the configuration.")
    } finally {
      setSaving(false)
    }
  }

  function handleResetToDefault() {
    const defaultCfg = DEFAULT_APP_CONFIGS[currentKey]
    setDraft(defaultCfg)
    setReleaseNotesText(defaultCfg.releaseNotes.join("\n"))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-slate-500">Loading app version configurations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="rounded-2xl border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="font-medium text-sm">{success}</AlertDescription>
        </Alert>
      )}

      {/* Target App & Platform Selector Header */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-gradient-to-br from-white via-white to-slate-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/40">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2.5">
                <Smartphone className="w-6 h-6 text-amber-500" />
                <span>Mobile App Version & Update Manager</span>
              </CardTitle>
              <CardDescription className="pt-1 text-xs">
                Control update popups, force updates, and release notes for Customer, Seller, and Rider apps.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                  draft.isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {draft.isActive ? "Alerts Active" : "Alerts Paused"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* App Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Target App:</span>
            <button
              type="button"
              onClick={() => setSelectedApp("customer")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedApp === "customer"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer App</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedApp("seller")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedApp === "seller"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Seller App</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedApp("rider")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedApp === "rider"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Rider App</span>
            </button>
          </div>

          {/* Platform Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Platform:</span>
            <button
              type="button"
              onClick={() => setSelectedPlatform("android")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedPlatform === "android"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Android (Google Play Store)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlatform("ios")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedPlatform === "ios"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              <Apple className="w-3.5 h-3.5 text-sky-500" />
              <span>iOS (Apple App Store)</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Left = Form Inputs, Right = Live Phone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-white dark:bg-slate-900">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    Configure Version Rules ({draft.app.toUpperCase()} - {draft.platform.toUpperCase()})
                  </CardTitle>
                  <CardDescription className="text-xs pt-1">
                    Set the latest version and update behavior for this app.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="active-toggle" className="text-xs font-semibold cursor-pointer">
                    Alert Active
                  </Label>
                  <Switch
                    id="active-toggle"
                    checked={draft.isActive}
                    onCheckedChange={(val) => handleDraftChange("isActive", val)}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-6">
              {/* Version Numbers Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latest Version String <span className="text-amber-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. 1.2.0"
                    value={draft.latestVersion}
                    onChange={(e) => handleDraftChange("latestVersion", e.target.value)}
                    className="rounded-xl h-11 text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-400">Version published on store (semantic: X.Y.Z)</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latest Version Code / Build <span className="text-amber-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 12"
                    value={draft.latestVersionCode}
                    onChange={(e) => handleDraftChange("latestVersionCode", parseInt(e.target.value, 10) || 1)}
                    className="rounded-xl h-11 text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-400">Integer build number (e.g. versionCode in Android)</p>
                </div>
              </div>

              {/* Minimum Supported Version Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Minimum Supported Version
                  </Label>
                  <Input
                    placeholder="e.g. 1.0.0"
                    value={draft.minSupportedVersion}
                    onChange={(e) => handleDraftChange("minSupportedVersion", e.target.value)}
                    className="rounded-xl h-11 text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-400">Any user below this version will be forced to update.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Minimum Version Code
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={draft.minSupportedVersionCode}
                    onChange={(e) => handleDraftChange("minSupportedVersionCode", parseInt(e.target.value, 10) || 1)}
                    className="rounded-xl h-11 text-sm font-semibold"
                  />
                  <p className="text-[11px] text-slate-400">Integer minimum build threshold</p>
                </div>
              </div>

              {/* Force Update Banner Toggle */}
              <div className="rounded-2xl p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <Label htmlFor="force-update" className="text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
                      Force Mandatory Update
                    </Label>
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
                    When ON, users cannot dismiss or skip the popup. They must update to continue using the app.
                  </p>
                </div>

                <Switch
                  id="force-update"
                  checked={draft.forceUpdate}
                  onCheckedChange={(val) => handleDraftChange("forceUpdate", val)}
                />
              </div>

              {/* Popup Title & Message */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Popup Title <span className="text-amber-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. New Update Available! 🚀"
                    value={draft.title}
                    onChange={(e) => handleDraftChange("title", e.target.value)}
                    className="rounded-xl h-11 text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Popup Description / Message <span className="text-amber-500">*</span>
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Describe why users should update..."
                    value={draft.message}
                    onChange={(e) => handleDraftChange("message", e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Release Notes (What's New) — 1 item per line
                  </Label>
                  <Textarea
                    rows={4}
                    placeholder="• Automatic smooth infinite scroll&#10;• Fair marketplace seller discovery&#10;• Bug fixes & performance boost"
                    value={releaseNotesText}
                    onChange={(e) => handleReleaseNotesChange(e.target.value)}
                    className="rounded-xl font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-400">Each line will appear as a bullet point in the mobile popup.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Store URL (Play Store / App Store) <span className="text-amber-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={
                        selectedPlatform === "android"
                          ? "https://play.google.com/store/apps/details?id=com.meeem..."
                          : "https://apps.apple.com/app/id..."
                      }
                      value={draft.storeUrl}
                      onChange={(e) => handleDraftChange("storeUrl", e.target.value)}
                      className="rounded-xl h-11 text-xs pr-10 font-mono"
                    />
                    {draft.storeUrl && (
                      <a
                        href={draft.storeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefault}
                  className="rounded-xl text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save & Publish Update</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Mobile Popup Preview */}
        <div className="lg:col-span-5 sticky top-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-gradient-to-b from-slate-900 to-slate-950 text-white overflow-hidden p-6">
            <div className="text-center pb-4">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-amber-400 border-amber-500/30 bg-amber-500/10 rounded-full px-3">
                Live Mobile Screen Preview
              </Badge>
              <p className="text-xs text-slate-400 pt-1">
                Real-time preview of what users will see on their phone
              </p>
            </div>

            {/* Smartphone Mockup Frame */}
            <div className="mx-auto max-w-[320px] rounded-[2.2rem] border-[6px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden relative">
              {/* Phone Notch */}
              <div className="h-5 bg-slate-800 flex justify-center items-center">
                <div className="w-20 h-3 bg-slate-900 rounded-b-lg" />
              </div>

              {/* App Content Background (dimmed) */}
              <div className="h-[460px] bg-slate-800/40 relative flex items-center justify-center p-4">
                {/* Backdrop Blur overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                {/* The Mobile Modal Dialog */}
                <div className="relative z-10 w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 shadow-2xl border border-slate-200/50 dark:border-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  {/* Icon Header */}
                  <div className="flex justify-center">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-md",
                        draft.forceUpdate
                          ? "bg-amber-500 text-white shadow-amber-500/30"
                          : "bg-emerald-500 text-white shadow-emerald-500/30"
                      )}
                    >
                      {draft.forceUpdate ? (
                        <ShieldAlert className="w-6 h-6 animate-pulse" />
                      ) : (
                        <Sparkles className="w-6 h-6" />
                      )}
                    </div>
                  </div>

                  {/* Title & Version Tag */}
                  <div className="text-center space-y-1">
                    <h4 className="font-extrabold text-sm leading-tight">
                      {draft.title || "New Update Available!"}
                    </h4>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Version {draft.latestVersion || "1.0.0"}
                    </span>
                  </div>

                  {/* Message */}
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 text-center leading-relaxed">
                    {draft.message || "A new version of the app is available for download."}
                  </p>

                  {/* Release Notes List */}
                  {draft.releaseNotes && draft.releaseNotes.length > 0 && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-1.5 border border-slate-100 dark:border-slate-800 text-[10px]">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">
                        What's New:
                      </span>
                      <ul className="space-y-1 text-slate-700 dark:text-slate-200">
                        {draft.releaseNotes.slice(0, 4).map((note, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="pt-2 space-y-1.5">
                    <button
                      type="button"
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-98 transition flex items-center justify-center gap-1.5"
                    >
                      <span>{draft.forceUpdate ? "Update to Continue" : "Update Now"}</span>
                    </button>

                    {!draft.forceUpdate && (
                      <button
                        type="button"
                        className="w-full py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        Later
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Phone Home Bar */}
              <div className="h-4 bg-slate-900 flex justify-center items-center">
                <div className="w-24 h-1 bg-slate-600 rounded-full" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
