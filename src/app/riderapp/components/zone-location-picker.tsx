"use client"

import React, { useState, useMemo, useCallback } from "react"
import { LOCATION_ZONES, ZoneDefinition } from "@/lib/location-zones"
import { Search, ChevronDown, ChevronUp, Check, CheckSquare, Square, MinusSquare, Sparkles, MapPin } from "lucide-react"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"

interface ZoneLocationPickerProps {
  selectedLocations: string[]
  onChange: (locations: string[], zones: string[]) => void
  disabled?: boolean
  className?: string
}

// Memoized single zone card to guarantee ultra-fast lag-free rendering
const ZoneCard = React.memo(function ZoneCard({
  zoneDef,
  selectedLocSet,
  onToggleZone,
  onToggleLocation,
  disabled,
  searchQuery,
  isExpanded,
  onToggleExpand,
}: {
  zoneDef: ZoneDefinition
  selectedLocSet: Set<string>
  onToggleZone: (zone: ZoneDefinition, allSelected: boolean) => void
  onToggleLocation: (location: string) => void
  disabled?: boolean
  searchQuery: string
  isExpanded: boolean
  onToggleExpand: (zoneName: string) => void
}) {
  const filteredRegions = useMemo(() => {
    if (!searchQuery) return zoneDef.regions
    const q = searchQuery.toLowerCase()
    const matchZone = zoneDef.zone.toLowerCase().includes(q)
    if (matchZone) return zoneDef.regions
    return zoneDef.regions.filter((r) => r.toLowerCase().includes(q))
  }, [zoneDef, searchQuery])

  if (filteredRegions.length === 0) return null

  // Calculate selection status
  let selectedCountInZone = 0
  for (let i = 0; i < zoneDef.regions.length; i++) {
    if (selectedLocSet.has(zoneDef.regions[i])) {
      selectedCountInZone++
    }
  }

  const isAllSelected = selectedCountInZone === zoneDef.regions.length && zoneDef.regions.length > 0
  const isPartiallySelected = selectedCountInZone > 0 && !isAllSelected

  return (
    <div className={cn(
      "border rounded-xl transition-all bg-card overflow-hidden",
      isAllSelected ? "border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/10 shadow-sm" : "border-border hover:border-slate-300 dark:hover:border-slate-700"
    )}>
      {/* Zone Header */}
      <div className="flex items-center justify-between p-3.5 bg-muted/40 hover:bg-muted/70 transition-colors select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              onToggleZone(zoneDef, isAllSelected)
            }}
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40",
              isAllSelected
                ? "bg-blue-600 border-blue-600 text-white"
                : isPartiallySelected
                ? "bg-blue-100 dark:bg-blue-900/60 border-blue-500 text-blue-700 dark:text-blue-300"
                : "border-slate-300 dark:border-slate-600 bg-background hover:border-blue-400"
            )}
            title={isAllSelected ? "Deselect entire zone" : "Select all locations in this zone"}
          >
            {isAllSelected ? (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            ) : isPartiallySelected ? (
              <MinusSquare className="w-3.5 h-3.5" />
            ) : null}
          </button>

          <div
            className="cursor-pointer flex items-center gap-2 min-w-0"
            onClick={() => onToggleExpand(zoneDef.zone)}
          >
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-sm text-foreground truncate">{zoneDef.zone}</span>
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal">
              {selectedCountInZone} / {zoneDef.regions.length}
            </Badge>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleExpand(zoneDef.zone)}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Internal Locations Grid */}
      {isExpanded && (
        <div className="p-3.5 pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border-t border-border/50 bg-background/50">
          {filteredRegions.map((region) => {
            const isChecked = selectedLocSet.has(region)
            return (
              <label
                key={region}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs cursor-pointer select-none transition-all",
                  isChecked
                    ? "border-blue-500/40 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-medium shadow-xs"
                    : "border-border/60 hover:border-slate-300 dark:hover:border-slate-700 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={isChecked}
                  onChange={() => onToggleLocation(region)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                />
                <span className="truncate" title={region}>{region}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
})

export function ZoneLocationPicker({
  selectedLocations = [],
  onChange,
  disabled = false,
  className,
}: ZoneLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>(() => {
    // Expand first 4 zones by default
    const initial: Record<string, boolean> = {}
    LOCATION_ZONES.slice(0, 4).forEach((z) => {
      initial[z.zone] = true
    })
    return initial
  })

  // Fast Set lookup for O(1) membership check
  const selectedLocSet = useMemo(() => new Set(selectedLocations), [selectedLocations])

  // Total active zones calculation
  const selectedZonesList = useMemo(() => {
    const zones: string[] = []
    LOCATION_ZONES.forEach((z) => {
      const hasAny = z.regions.some((r) => selectedLocSet.has(r))
      if (hasAny) zones.push(z.zone)
    })
    return zones
  }, [selectedLocSet])

  // Toggle single location
  const handleToggleLocation = useCallback(
    (loc: string) => {
      if (disabled) return
      const nextSet = new Set(selectedLocSet)
      if (nextSet.has(loc)) {
        nextSet.delete(loc)
      } else {
        nextSet.add(loc)
      }
      const newLocs = Array.from(nextSet)
      const newZones = LOCATION_ZONES.filter((z) => z.regions.some((r) => nextSet.has(r))).map((z) => z.zone)
      onChange(newLocs, newZones)
    },
    [disabled, selectedLocSet, onChange]
  )

  // Toggle entire zone
  const handleToggleZone = useCallback(
    (zoneDef: ZoneDefinition, allCurrentlySelected: boolean) => {
      if (disabled) return
      const nextSet = new Set(selectedLocSet)
      if (allCurrentlySelected) {
        // Deselect all in zone
        zoneDef.regions.forEach((r) => nextSet.delete(r))
      } else {
        // Select all in zone
        zoneDef.regions.forEach((r) => nextSet.add(r))
      }
      const newLocs = Array.from(nextSet)
      const newZones = LOCATION_ZONES.filter((z) => z.regions.some((r) => nextSet.has(r))).map((z) => z.zone)
      onChange(newLocs, newZones)
    },
    [disabled, selectedLocSet, onChange]
  )

  // Select all locations in entire country
  const handleSelectAll = useCallback(() => {
    if (disabled) return
    const allLocs = LOCATION_ZONES.flatMap((z) => z.regions)
    const allZones = LOCATION_ZONES.map((z) => z.zone)
    onChange(Array.from(new Set(allLocs)), allZones)
  }, [disabled, onChange])

  // Clear all selections
  const handleClearAll = useCallback(() => {
    if (disabled) return
    onChange([], [])
  }, [disabled, onChange])

  const toggleExpand = useCallback((zoneName: string) => {
    setExpandedZones((prev) => ({ ...prev, [zoneName]: !prev[zoneName] }))
  }, [])

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    LOCATION_ZONES.forEach((z) => {
      all[z.zone] = true
    })
    setExpandedZones(all)
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedZones({})
  }, [])

  const totalAllLocations = useMemo(() => {
    return LOCATION_ZONES.reduce((acc, z) => acc + z.regions.length, 0)
  }, [])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/40 rounded-2xl border border-border/80">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Delivery Service Zones & Locations
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select the zones & specific areas where you can deliver orders.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 text-white text-xs px-2.5 py-1">
            {selectedLocations.length} / {totalAllLocations} Locations
          </Badge>
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold">
            {selectedZonesList.length} / {LOCATION_ZONES.length} Zones
          </Badge>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search zones or locations (e.g., Lakka, Goderich, Zone 1)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-background"
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={disabled || selectedLocations.length === totalAllLocations}
            className="text-xs h-9 rounded-xl font-medium"
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={disabled || selectedLocations.length === 0}
            className="text-xs h-9 rounded-xl font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Clear All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="text-xs h-9 rounded-xl text-muted-foreground"
          >
            Expand
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="text-xs h-9 rounded-xl text-muted-foreground"
          >
            Collapse
          </Button>
        </div>
      </div>

      {/* Zone Cards List */}
      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
        {LOCATION_ZONES.map((zoneDef) => (
          <ZoneCard
            key={zoneDef.zone}
            zoneDef={zoneDef}
            selectedLocSet={selectedLocSet}
            onToggleZone={handleToggleZone}
            onToggleLocation={handleToggleLocation}
            disabled={disabled}
            searchQuery={searchQuery}
            isExpanded={!!expandedZones[zoneDef.zone] || !!searchQuery}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  )
}
