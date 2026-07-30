"use client"

import { useState, useEffect } from "react"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"

type BudgetProps = {
  defaultTotalBudget?: number | string
  defaultMaxCpc?: number | string
}

export function BudgetAudienceField({ defaultTotalBudget = "", defaultMaxCpc = "" }: BudgetProps) {
  const [totalBudget, setTotalBudget] = useState(defaultTotalBudget ? String(defaultTotalBudget) : "")
  const [targetAudience, setTargetAudience] = useState(() => {
    if (defaultTotalBudget && defaultMaxCpc) {
      const tb = Number(defaultTotalBudget)
      const mc = Number(defaultMaxCpc)
      if (tb > 0 && mc > 0) return String(Math.round(tb / mc))
    }
    return ""
  })

  useEffect(() => {
    if (defaultTotalBudget) setTotalBudget(String(defaultTotalBudget))
    if (defaultTotalBudget && defaultMaxCpc) {
      const tb = Number(defaultTotalBudget)
      const mc = Number(defaultMaxCpc)
      if (tb > 0 && mc > 0) setTargetAudience(String(Math.round(tb / mc)))
    }
  }, [defaultTotalBudget, defaultMaxCpc])

  const budget = parseFloat(totalBudget)
  const audience = parseInt(targetAudience, 10)
  const isValid = !isNaN(budget) && budget > 0 && !isNaN(audience) && audience >= 1
  const maxCpc = isValid ? (budget / audience).toFixed(2) : ""

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="totalBudget">Total budget *</Label>
          <Input
            id="totalBudget"
            name="totalBudget"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="e.g. 50"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetAudience">Target audience (number of clicks) *</Label>
          <Input
            id="targetAudience"
            name="targetAudience"
            type="number"
            min="1"
            step="1"
            required
            placeholder="e.g. 100"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Max cost per click is auto-calculated from budget ÷ audience.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Max cost per click (CPC)</Label>
        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
          {maxCpc ? `${maxCpc} (auto)` : "—"}
        </div>
        <input type="hidden" name="maxCpc" value={maxCpc} readOnly />
      </div>
    </div>
  )
}
