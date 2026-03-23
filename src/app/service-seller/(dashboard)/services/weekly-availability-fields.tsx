"use client"

import { useState, useCallback } from "react"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"

export type DayAvailability = {
  unavailable: boolean
  shiftStart: string
  shiftEnd: string
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const defaultDay = (): DayAvailability => ({
  unavailable: false,
  shiftStart: "09:00",
  shiftEnd: "17:00",
})

function parseWeeklyAvailability(json: unknown): DayAvailability[] {
  if (Array.isArray(json) && json.length === 7) {
    return json.map((d) => ({
      unavailable: Boolean(d?.unavailable),
      shiftStart: typeof d?.shiftStart === "string" ? d.shiftStart : "09:00",
      shiftEnd: typeof d?.shiftEnd === "string" ? d.shiftEnd : "17:00",
    }))
  }
  return Array.from({ length: 7 }, defaultDay)
}

export function WeeklyAvailabilityFields({
  name = "weeklyAvailability",
  defaultValue,
}: {
  name?: string
  defaultValue?: unknown
}) {
  const [days, setDays] = useState<DayAvailability[]>(() =>
    defaultValue ? parseWeeklyAvailability(defaultValue) : Array.from({ length: 7 }, defaultDay)
  )

  const updateDay = useCallback((index: number, patch: Partial<DayAvailability>) => {
    setDays((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }, [])

  const jsonValue = JSON.stringify(days)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-px bg-border">
          {DAY_NAMES.map((dayName, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 p-4 sm:p-5 bg-card min-w-0"
            >
              <span className="text-sm font-semibold text-foreground">{dayName}</span>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={!days[index].unavailable}
                  onChange={(e) => updateDay(index, { unavailable: !e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-xs text-muted-foreground">Available on this day</span>
              </label>
              {!days[index].unavailable && (
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <Input
                      type="time"
                      value={days[index].shiftStart}
                      onChange={(e) => updateDay(index, { shiftStart: e.target.value })}
                      className="h-9 text-sm w-full"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-xs text-muted-foreground">End</Label>
                    <Input
                      type="time"
                      value={days[index].shiftEnd}
                      onChange={(e) => updateDay(index, { shiftEnd: e.target.value })}
                      className="h-9 text-sm w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name={name} value={jsonValue} />
    </div>
  )
}
