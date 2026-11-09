"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Percent, Loader2, AlertCircle } from "lucide-react"

export interface CommissionModalTarget {
  id: string
  name?: string | null
  businessName?: string | null
  email?: string | null
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  commissionRate?: number | null
  baseCommissionRate?: number
}

interface CommissionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seller: CommissionModalTarget | null
  onSuccess?: (newRate: number | null) => Promise<void> | void
}

export function CommissionModal({
  open,
  onOpenChange,
  seller,
  onSuccess,
}: CommissionModalProps) {
  const [commissionValue, setCommissionValue] = useState<number | "">("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && seller) {
      setCommissionValue(
        seller.commissionRate != null ? Number(seller.commissionRate) : ""
      )
      setError(null)
    }
  }, [open, seller])

  if (!seller) return null

  const baseRate = seller.baseCommissionRate ?? 10
  const sellerDisplayName =
    seller.businessName || seller.name || seller.email || "Partner"
  const typeLabel =
    seller.sellerType === "HOTEL"
      ? "hotel"
      : seller.sellerType === "RESTAURANT"
      ? "restaurant"
      : seller.sellerType === "SERVICE"
      ? "service"
      : "product"

  const handleSave = async () => {
    setError(null)
    const rateToSave = commissionValue === "" ? null : Number(commissionValue)

    if (rateToSave !== null) {
      if (isNaN(rateToSave) || rateToSave < 0 || rateToSave > 100) {
        setError("Commission rate must be between 0% and 100%.")
        return
      }
    }

    let endpoint = `/api/admin/sellers/${seller.id}/commission`
    if (seller.sellerType === "HOTEL") {
      endpoint = `/api/admin/hotel-sellers/${seller.id}/commission`
    } else if (seller.sellerType === "RESTAURANT") {
      endpoint = `/api/admin/restaurant-sellers/${seller.id}/commission`
    }

    try {
      setLoading(true)
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rateToSave }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || "Failed to update commission rate")
      }

      if (onSuccess) {
        await onSuccess(rateToSave)
      }
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Set Commission Rate
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                For{" "}
                <strong className="text-foreground">{sellerDisplayName}</strong>{" "}
                ({typeLabel} partner)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="py-3 space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="commission-rate-input"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
            >
              <span>Commission Percentage (%)</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Admin Base:{" "}
                <strong className="text-purple-600 dark:text-purple-400 font-bold">
                  {baseRate}%
                </strong>
              </span>
            </Label>
            <div className="relative">
              <Input
                id="commission-rate-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder={`e.g. ${baseRate}`}
                className="rounded-2xl text-sm pr-9 h-11"
                value={commissionValue}
                onChange={(e) =>
                  setCommissionValue(
                    e.target.value === "" ? "" : parseFloat(e.target.value)
                  )
                }
                disabled={loading}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none font-semibold text-xs">
                %
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              💡 Leave empty to use admin default {typeLabel} base commission (
              <strong className="text-foreground">{baseRate}%</strong>).
            </p>
            <p className="text-[11px] text-muted-foreground">
              📌 Custom rates take immediate effect on all new customer orders / bookings.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-2xl text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
            disabled={loading}
            onClick={handleSave}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Commission Rate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

