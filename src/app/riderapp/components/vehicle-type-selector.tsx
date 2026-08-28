"use client"

import React from "react"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"
import { Bike, Car, Truck, Check } from "lucide-react"

export interface VehicleTypeOption {
  id: string
  label: string
  sublabel: string
  icon: "bike" | "tricycle" | "car"
}

export const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  {
    id: "2_WHEELER",
    label: "2 Wheeler",
    sublabel: "Motorbike, Scooter, Bicycle",
    icon: "bike",
  },
  {
    id: "3_WHEELER",
    label: "3 Wheeler",
    sublabel: "Tricycle, Keke, Auto Rickshaw",
    icon: "tricycle",
  },
  {
    id: "4_WHEELER",
    label: "4 Wheeler",
    sublabel: "Car, Delivery Van, Small Truck",
    icon: "car",
  },
]

interface VehicleTypeSelectorProps {
  selectedTypes?: string[]
  selectedType?: string
  onChange: (types: string[]) => void
  onSingleChange?: (type: string) => void
  disabled?: boolean
  className?: string
}

export function VehicleTypeSelector({
  selectedTypes = [],
  selectedType,
  onChange,
  onSingleChange,
  disabled = false,
  className,
}: VehicleTypeSelectorProps) {
  const activeType = selectedType || (selectedTypes.length > 0 ? selectedTypes[0] : "")

  const handleSelect = (id: string) => {
    if (disabled) return
    onChange([id])
    onSingleChange?.(id)
  }

  const renderIcon = (type: "bike" | "tricycle" | "car") => {
    switch (type) {
      case "bike":
        return <Bike className="w-5 h-5" />
      case "tricycle":
        return <Truck className="w-5 h-5" />
      case "car":
        return <Car className="w-5 h-5" />
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {VEHICLE_TYPE_OPTIONS.map((opt) => {
          const isSelected = activeType === opt.id
          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                "relative flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                isSelected
                  ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 shadow-sm ring-1 ring-blue-600"
                  : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-card text-foreground hover:bg-muted/40",
                disabled && "opacity-60 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-lg shrink-0 mt-0.5 transition-colors",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {renderIcon(opt.icon)}
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                  {opt.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {opt.sublabel}
                </div>
              </div>

              <div
                className={cn(
                  "absolute top-3.5 right-3.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  isSelected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-background"
                )}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
          )
        })}
      </div>
      {!activeType && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          * Please select the single vehicle type you operate for deliveries.
        </p>
      )}
    </div>
  )
}
