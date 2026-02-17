"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  const pricePerItem = Math.max(0, basePrice - discount)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customer will see: base price, discount, then price per item (base − discount). At checkout, 15% GST is added only if &quot;Has GST&quot; is Yes.
      </p>
      {showBasePrice && (
        <div className="space-y-2">
          <Label htmlFor={basePriceName}>{basePriceLabel}{requireBasePrice ? " *" : ""}</Label>
          <Input
            id={basePriceName}
            name={basePriceName}
            type="number"
            step="0.01"
            min="0"
            required={requireBasePrice}
            placeholder="0.00"
            defaultValue={defaultBasePrice}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={discountName}>Discount (amount per item)</Label>
        <Input
          id={discountName}
          name={discountName}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          defaultValue={defaultDiscount}
          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="rounded-md border bg-muted/50 p-3 text-sm">
        <div className="flex justify-between font-medium">
          <span className="text-muted-foreground">Price per item (after discount)</span>
          <span>{formatCurrency(pricePerItem)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Has GST?</label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={hasGstName}
            name={hasGstName}
            value="true"
            defaultChecked={defaultHasGst}
            onChange={(e) => setHasGst(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor={hasGstName} className="text-sm font-normal cursor-pointer">
            {hasGst ? "Yes (15% GST at checkout)" : "No (no GST)"}
          </Label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Stored in DB as: base price, discount, has GST (Y/N). Customer pays: (price per item × quantity), then +15% GST only if Has GST = Yes.
      </p>
    </div>
  )
}
