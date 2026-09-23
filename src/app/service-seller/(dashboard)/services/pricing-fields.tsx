"use client"

import { useEffect, useState } from "react"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { formatCurrency } from "@/lib/utils"

export function PricingFields({
  basePriceName = "basePrice",
  discountName = "discount",
  hasGstName = "hasGst",
  defaultBasePrice = 0,
  defaultDiscount = 0,
  defaultHasGst = true,
  basePriceLabel = "Base price",
  showBasePrice = true,
  requireBasePrice = true,
}: {
  basePriceName?: string
  discountName?: string
  hasGstName?: string
  defaultBasePrice?: number
  defaultDiscount?: number
  defaultHasGst?: boolean
  basePriceLabel?: string
  showBasePrice?: boolean
  requireBasePrice?: boolean
}) {
  const [basePrice, setBasePrice] = useState(defaultBasePrice)
  const [discount, setDiscount] = useState(defaultDiscount)
  const [hasGst, setHasGst] = useState(defaultHasGst)

  useEffect(() => {
    const read = () => {
      const baseEl = document.getElementById(basePriceName) as HTMLInputElement | null
      const discEl = document.getElementById(discountName) as HTMLInputElement | null
      const gstEl = document.getElementById(hasGstName) as HTMLInputElement | null
      if (baseEl) setBasePrice(parseFloat(baseEl.value) || 0)
      if (discEl) setDiscount(parseFloat(discEl.value) || 0)
      if (gstEl) setHasGst(gstEl.checked)
    }
    read()
    const t = setInterval(read, 400)
    return () => clearInterval(t)
  }, [basePriceName, discountName, hasGstName])

  const sellingPrice = discount > 0 ? discount : basePrice
  const discountAmount = (discount > 0 && basePrice > 0 && discount < basePrice) ? Math.max(0, basePrice - discount) : 0
  const discountPct = discountAmount > 0 && basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the regular price and the final selling price you want customers to pay.
      </p>
      {showBasePrice && (
        <div className="space-y-2">
          <Label htmlFor={basePriceName}>{basePriceLabel}{requireBasePrice ? " *" : ""}</Label>
          <Input id={basePriceName} name={basePriceName} type="number" step="0.01" min="0" required={requireBasePrice} placeholder="0.00" defaultValue={defaultBasePrice} onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={discountName}>Selling Price / Discounted Price</Label>
        <Input id={discountName} name={discountName} type="number" step="0.01" min="0" placeholder="e.g. 80 (leave 0 or empty for full base price)" defaultValue={defaultDiscount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
        <p className="text-[11px] text-muted-foreground">
          Enter the final price you want to sell (e.g. if Base Price is ₹100 and you enter ₹80, the customer will buy at ₹80).
        </p>
        {discount > basePrice && basePrice > 0 && (
          <p className="text-xs text-destructive font-medium">Selling price cannot exceed base price ({formatCurrency(basePrice)})</p>
        )}
      </div>
      <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1.5">
        <div className="flex justify-between font-medium">
          <span className="text-muted-foreground">Customer pays</span>
          <span className="text-emerald-600 font-semibold">{formatCurrency(sellingPrice)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Customer discount</span>
            <span>{formatCurrency(discountAmount)} ({discountPct}% OFF)</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 hidden">
        <label className="text-sm font-medium">Has GST?</label>
        <div className="flex items-center gap-2">
          <input type="checkbox" id={hasGstName} name={hasGstName} value="true" defaultChecked={defaultHasGst} onChange={(e) => setHasGst(e.target.checked)} className="h-4 w-4 rounded border-input" />
          <Label htmlFor={hasGstName} className="text-sm font-normal cursor-pointer">{hasGst ? "Yes (15% GST at checkout)" : "No (no GST)"}</Label>
        </div>
      </div>
    </div>
  )
}
