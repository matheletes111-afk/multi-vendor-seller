"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { AdCreativeField } from "@/components/ads/ad-creative-field"
import { BudgetAudienceField } from "@/components/ads/budget-audience-field"
import { CountryMultiSelect } from "@/components/ads/country-multi-select"
import { cn } from "@/lib/utils"

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
  const isPromoteService = adType === "promote_service"
  const hasWeb = placements.includes("WEB")
  const hasMobile = placements.includes("MOBILE")

  function togglePlacement(p: string) {
    setPlacements(prev => {
      const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
      return next.length > 0 ? next : prev // Prevent unchecking both
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setLoading(true)
    // The server action will redirect on success, or redirect with an error.
    // If it throws or we return, the loading state might just stay true if navigating away, which is fine.
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="adType" value={adType} />

      <div className="space-y-3">
        <Label htmlFor="ad-type-choice">Ad type</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            id="ad-type-choice"
            onClick={() => setAdType("promote_service")}
            className={cn(
              "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
              adType === "promote_service" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            )}
          >
            <span className="font-medium">Promote a service</span>
            <span className="text-sm text-muted-foreground">Link the ad to one of your services.</span>
          </button>
          <button
            type="button"
            onClick={() => setAdType("own_ad")}
            className={cn(
              "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
              adType === "own_ad" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            )}
          >
            <span className="font-medium">Own business ad</span>
            <span className="text-sm text-muted-foreground">Image or video for your business — no service link.</span>
          </button>
        </div>
      </div>

      {isPromoteService && (
        <div className="space-y-2">
          <Label htmlFor="serviceId">Service to promote *</Label>
          <select
            id="serviceId"
            name="serviceId"
            required={isPromoteService}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">Create a service first from Services.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Ad title *</Label>
        <Input id="title" name="title" required placeholder="e.g. Book Your Session Today" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          name="description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Short description for the ad"
        />
      </div>

      <div className="space-y-3">
        <Label>Placements *</Label>
        <div className="flex gap-4">
          <label className={cn(
            "flex items-center gap-2 border p-3 rounded-md cursor-pointer transition-colors flex-1",
            hasWeb ? "border-primary bg-primary/5" : "hover:bg-muted/40"
          )}>
            <input 
              type="checkbox" 
              checked={hasWeb} 
              onChange={() => togglePlacement("WEB")}
              className="rounded border-input text-primary focus:ring-primary"
            />
            <span className="font-medium">Web Banners</span>
          </label>
          <label className={cn(
            "flex items-center gap-2 border p-3 rounded-md cursor-pointer transition-colors flex-1",
            hasMobile ? "border-primary bg-primary/5" : "hover:bg-muted/40"
          )}>
            <input 
              type="checkbox" 
              checked={hasMobile} 
              onChange={() => togglePlacement("MOBILE")}
              className="rounded border-input text-primary focus:ring-primary"
            />
            <span className="font-medium">Mobile Stories</span>
          </label>
        </div>
        {placements.map(p => (
          <input key={p} type="hidden" name="placements" value={p} />
        ))}
      </div>

      <div className="space-y-6 pt-2">
        {hasWeb && (
          <div className="rounded-lg border p-4 bg-card">
            <AdCreativeField label="Web Creative (Image or Video) *" />
          </div>
        )}
        
        {hasMobile && (
          <div className="rounded-lg border p-4 bg-card">
            <AdCreativeField 
              label="Mobile Creative (Portrait Image or Video) *" 
              requiresPortrait 
              fieldNamePrefix="mobile" 
            />
          </div>
        )}
      </div>

      <BudgetAudienceField />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startAt">Start date *</Label>
          <Input id="startAt" name="startAt" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endAt">End date *</Label>
          <Input id="endAt" name="endAt" type="datetime-local" required />
        </div>
      </div>

      <CountryMultiSelect />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="targetAgeMin">Target age min (optional)</Label>
          <Input
            id="targetAgeMin"
            name="targetAgeMin"
            type="number"
            min="0"
            max="120"
            placeholder="e.g. 18"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetAgeMax">Target age max (optional)</Label>
          <Input
            id="targetAgeMax"
            name="targetAgeMax"
            type="number"
            min="0"
            max="120"
            placeholder="e.g. 65"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="expandAudience" name="expandAudience" className="rounded border-input" />
          <Label htmlFor="expandAudience">Expand audience</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          When on: if your target countries would show the ad to very few people, we may show it to a broader audience so it still gets reach. When off: ad is shown only to users matching your selected countries.
        </p>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Ad"}</Button>
        <Link href="/service-seller/admanagement">
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
      </div>
    </form>
  )
}
