"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { cn } from "@/lib/utils"
import { Monitor, Smartphone, Megaphone, Info } from "lucide-react"
import { getYoutubeEmbedUrl } from "@/lib/youtube"
import { Card, CardContent } from "@/ui/card"

type CreativeState = { type: "IMAGE" | "VIDEO", url: string | null }

export function ServiceAdFormClient({
  services,
  action,
}: {
  services: { id: string; name: string }[]
  action: (formData: FormData) => void
}) {
  const [adType, setAdType] = useState<"promote_service" | "own_ad">("promote_service")
  const [loading, setLoading] = useState(false)
  const [placements, setPlacements] = useState<string[]>(["WEB"])

  // Live Preview States
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [webCreative, setWebCreative] = useState<CreativeState>({ type: "IMAGE", url: null })
  const [mobileCreative, setMobileCreative] = useState<CreativeState>({ type: "IMAGE", url: null })

  const isPromoteService = adType === "promote_service"
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  const handleWebCreativeChange = useCallback((c: CreativeState) => {
    setWebCreative(c)
  }, [])

  const handleMobileCreativeChange = useCallback((c: CreativeState) => {
    setMobileCreative(c)
  }, [])

  function togglePlacement(p: string) {
    setPlacements(prev => {
      const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
      return next.length > 0 ? next : prev // Prevent unchecking both
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setLoading(true)
  }

  const renderMockup = (creative: CreativeState, isMobile: boolean) => {
    const isVideo = creative.type === "VIDEO"
    const embedUrl = isVideo && creative.url ? getYoutubeEmbedUrl(creative.url) : null

    return (
      <div className={cn(
        "relative bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800",
        isMobile ? "aspect-[9/16] w-full max-w-[260px] mx-auto" : "aspect-video w-full"
      )}>
        {/* Content */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          {creative.url ? (
            isVideo ? (
              embedUrl ? (
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
              ) : (
                <video src={creative.url} className="w-full h-full object-cover" autoPlay muted loop />
              )
            ) : (
              <img src={creative.url} className="w-full h-full object-cover" alt="Preview" />
            )
          ) : (
            <div className="flex flex-col items-center text-slate-500 p-4 text-center">
              <Megaphone className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-xs">No {creative.type.toLowerCase()} selected</p>
            </div>
          )}
        </div>

        {/* Overlay Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary text-[10px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Sponsored</span>
          </div>
          <h4 className="text-white font-bold text-sm line-clamp-1 drop-shadow-md">
            {title || "Your Service Title"}
          </h4>
          <p className="text-white/70 text-[10px] line-clamp-2 mt-0.5">
            {description || "Add an engaging description to see it in action."}
          </p>
        </div>

        {/* Device elements for mobile */}
        {isMobile && (
          <>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full" />
            <div className="absolute top-3 right-4 flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Form Column */}
      <div className="lg:col-span-7">
        <form action={action} onSubmit={handleSubmit} className="space-y-8">
          <input type="hidden" name="adType" value={adType} />

          <div className="space-y-4">
            <Label className="text-base font-semibold">Promotion type</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAdType("promote_service")}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                  adType === "promote_service" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <span className="font-bold text-slate-900">Promote a service</span>
                <span className="text-xs text-slate-500 mt-1">Directly link this ad to one of your existing services.</span>
              </button>
              <button
                type="button"
                onClick={() => setAdType("own_ad")}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                  adType === "own_ad" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <span className="font-bold text-slate-900">Own business ad</span>
                <span className="text-xs text-slate-500 mt-1">General branding for your store — no direct service link.</span>
              </button>
            </div>
          </div>

          {isPromoteService && (
            <div className="space-y-3">
              <Label htmlFor="serviceId" className="font-semibold text-slate-700">Linked Service *</Label>
              <select
                id="serviceId"
                name="serviceId"
                required={isPromoteService}
                className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm transition-focus focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
              >
                <option value="">Select a service to link</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {services.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">You haven't created any services yet. Go to Services to add one.</p>
              )}
            </div>
          )}

          <div className="space-y-4 border-t pt-6">
            <Label className="text-base font-semibold">Ad</Label>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700">Ad title *</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder="e.g. Professional Photo Session"
                  className="h-12 rounded-xl"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700">Ad description (optional)</Label>
                <textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-focus focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                  placeholder="Engaging description for your audience..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <Label className="text-base font-semibold">Placements</Label>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className={cn(
                "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                hasWeb ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
              )}>
                <input
                  type="checkbox"
                  checked={hasWeb}
                  onChange={() => togglePlacement("WEB")}
                  className="h-5 w-5 rounded border-slate-300 text-primary"
                />
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-slate-500" />
                  <span className="font-bold text-slate-900">Web Banners</span>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 border-2 p-4 rounded-xl cursor-pointer transition-all flex-1",
                hasMobile ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
              )}>
                <input
                  type="checkbox"
                  checked={hasMobile}
                  onChange={() => togglePlacement("MOBILE")}
                  className="h-5 w-5 rounded border-slate-300 text-primary"
                />
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-slate-500" />
                  <span className="font-bold text-slate-900">Mobile Stories</span>
                </div>
              </label>
            </div>
            {placements.map(p => (
              <input key={p} type="hidden" name="placements" value={p} />
            ))}
          </div>

          <div className="space-y-6 pt-6 border-t">
            <Label className="text-base font-semibold">Creatives</Label>
            <div className="grid gap-6">
              {hasWeb && (
                <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50/30">
                  <AdCreativeField
                    label="Main Web Banner (Landscape) *"
                    onCreativeChange={handleWebCreativeChange}
                  />
                </div>
              )}

              {hasMobile && (
                <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50/30">
                  <AdCreativeField
                    label="Mobile Story Creative (Portrait) *"
                    requiresPortrait
                    fieldNamePrefix="mobile"
                    onCreativeChange={handleMobileCreativeChange}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 border-t pt-6">
            <Label className="text-base font-semibold">Campaign Budget</Label>
            <BudgetAudienceField />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt" className="text-slate-700">Launch Date *</Label>
                <Input id="startAt" name="startAt" type="datetime-local" required className="h-11 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt" className="text-slate-700">End Date *</Label>
                <Input id="endAt" name="endAt" type="datetime-local" required className="h-11 rounded-lg" />
              </div>
            </div>
            <CountryMultiSelect />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetAgeMin">Audience Age (Min)</Label>
                <Input id="targetAgeMin" name="targetAgeMin" type="number" min={0} max={120} placeholder="18" className="h-11 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAgeMax">Audience Age (Max)</Label>
                <Input id="targetAgeMax" name="targetAgeMax" type="number" min={0} max={120} placeholder="65" className="h-11 rounded-lg" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <input type="checkbox" id="expandAudience" name="expandAudience" className="h-5 w-5 rounded border-slate-300 text-primary" />
              <div className="space-y-0.5">
                <Label htmlFor="expandAudience" className="font-bold">Expand target audience</Label>
                <p className="text-[10px] text-slate-500 leading-tight">Increase reach if targeting is too narrow.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button type="submit" disabled={loading} size="lg" className="min-w-[160px] rounded-full text-base font-bold shadow-lg shadow-primary/20">
              {loading ? "Creating..." : "Create & Submit Ad"}
            </Button>
            <Link href="/service-seller/admanagement">
              <Button type="button" variant="ghost" className="rounded-full text-slate-500">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>

      {/* Preview Column - Sticky */}
      <div className="lg:col-span-5 space-y-8 sticky top-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Live Preview</h2>
          <Badge>Demo View</Badge>
        </div>

        <div className="space-y-8">
          {hasMobile && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">
                <Smartphone className="h-4 w-4" />
                Mobile Story
              </div>
              {renderMockup(mobileCreative, true)}
            </div>
          )}

          {hasWeb && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">
                <Monitor className="h-4 w-4" />
                Web Banner
              </div>
              {renderMockup(webCreative, false)}
            </div>
          )}

          {!hasWeb && !hasMobile && (
            <div className="py-20 text-center border-dashed border-2 rounded-2xl bg-slate-50">
              <p className="text-slate-400">Select a placement to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
      {children}
    </span>
  )
}
