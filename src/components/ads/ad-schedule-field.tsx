"use client"

import { useState, useEffect } from "react"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Calendar, Clock, Sparkles } from "lucide-react"

export function formatToDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function parseValidDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export interface AdScheduleFieldProps {
  defaultStartAt?: string | Date | null
  defaultEndAt?: string | Date | null
  onDatesChange?: (dates: { startAt: string; endAt: string; days: number }) => void
}

const DURATION_PRESETS = [
  { label: "3 Days", days: 3 },
  { label: "7 Days", days: 7, isDefault: true },
  { label: "14 Days", days: 14 },
  { label: "30 Days (1 Month)", days: 30 },
  { label: "90 Days (3 Months)", days: 90 },
]

export function AdScheduleField({
  defaultStartAt,
  defaultEndAt,
  onDatesChange,
}: AdScheduleFieldProps) {
  const [startAt, setStartAt] = useState<string>(() => {
    const parsed = parseValidDate(defaultStartAt)
    if (parsed) return formatToDateTimeLocal(parsed)
    const now = new Date()
    // Round to next 5 minutes
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0)
    return formatToDateTimeLocal(now)
  })

  const [endAt, setEndAt] = useState<string>(() => {
    const parsed = parseValidDate(defaultEndAt)
    if (parsed) return formatToDateTimeLocal(parsed)
    const future = new Date()
    future.setDate(future.getDate() + 7)
    future.setMinutes(Math.ceil(future.getMinutes() / 5) * 5, 0, 0)
    return formatToDateTimeLocal(future)
  })

  const [selectedDuration, setSelectedDuration] = useState<number | null>(() => {
    if (defaultStartAt || defaultEndAt) return null
    return 7
  })

  // Calculate days between start and end
  const calculateDays = (startStr: string, endStr: string) => {
    const s = new Date(startStr).getTime()
    const e = new Date(endStr).getTime()
    if (isNaN(s) || isNaN(e) || e <= s) return 0
    return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)))
  }

  const durationDays = calculateDays(startAt, endAt)

  // Notify parent of changes
  useEffect(() => {
    if (onDatesChange && startAt && endAt) {
      onDatesChange({ startAt, endAt, days: durationDays })
    }
  }, [startAt, endAt, durationDays, onDatesChange])

  // Apply quick preset (e.g. 7, 14, 30 days)
  const handleApplyPreset = (days: number) => {
    setSelectedDuration(days)
    const s = startAt ? new Date(startAt) : new Date()
    const base = isNaN(s.getTime()) ? new Date() : s
    const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
    setEndAt(formatToDateTimeLocal(newEnd))
  }

  // Handle manual start date change
  const handleStartChange = (val: string) => {
    setStartAt(val)
    if (selectedDuration && val) {
      const s = new Date(val)
      if (!isNaN(s.getTime())) {
        const newEnd = new Date(s.getTime() + selectedDuration * 24 * 60 * 60 * 1000)
        setEndAt(formatToDateTimeLocal(newEnd))
      }
    }
  }

  // Handle manual end date change
  const handleEndChange = (val: string) => {
    setEndAt(val)
    setSelectedDuration(null) // User picked custom end date
  }

  // Quick button: set start date to right now
  const handleSetStartToNow = () => {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0)
    const nowStr = formatToDateTimeLocal(now)
    setStartAt(nowStr)
    if (selectedDuration) {
      const newEnd = new Date(now.getTime() + selectedDuration * 24 * 60 * 60 * 1000)
      setEndAt(formatToDateTimeLocal(newEnd))
    }
  }

  const minStart = formatToDateTimeLocal(new Date(Date.now() - 24 * 60 * 60 * 1000))

  return (
    <div className="space-y-3">
      {/* Quick Duration Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Campaign Duration Presets:
        </span>
        <button
          type="button"
          onClick={handleSetStartToNow}
          className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
        >
          <Clock className="w-3 h-3" />
          Set Launch to Right Now
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((p) => {
          const isSelected = selectedDuration === p.days
          return (
            <button
              key={p.days}
              type="button"
              onClick={() => handleApplyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-[1.02]"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Date & Time Inputs */}
      <div className="grid gap-4 md:grid-cols-2 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor="startAt" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Launch Date &amp; Time *
          </Label>
          <Input
            id="startAt"
            name="startAt"
            type="datetime-local"
            required
            value={startAt}
            min={minStart}
            onChange={(e) => handleStartChange(e.target.value)}
            className="h-11 rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endAt" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            End Date &amp; Time *
          </Label>
          <Input
            id="endAt"
            name="endAt"
            type="datetime-local"
            required
            value={endAt}
            min={startAt || minStart}
            onChange={(e) => handleEndChange(e.target.value)}
            className="h-11 rounded-lg text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      {/* Duration Summary Helper */}
      {durationDays > 0 && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>
            Campaign will run for <strong>{durationDays} {durationDays === 1 ? "day" : "days"}</strong>.
          </span>
        </div>
      )}
    </div>
  )
}

