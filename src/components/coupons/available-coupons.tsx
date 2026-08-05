"use client"

import { useEffect, useState } from "react"
import { Tag, Check, ChevronDown, ChevronUp, Ticket, Sparkles } from "lucide-react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"

export type AvailableCoupon = {
  id: string
  code: string
  discountType: "PERCENTAGE" | "FIXED"
  discountValue: number
  type: string
  minOrderValue: number
  endDate: string
  categoryId?: string | null
}

type AvailableCouponsProps = {
  type: "PRODUCT" | "SERVICE" | "HOTEL" | "FOOD" | "SELLER"
  subtotal: number
  onApplyCoupon: (code: string) => void
  appliedCode?: string | null
  loading?: boolean
}

export function AvailableCoupons({
  type,
  subtotal,
  onApplyCoupon,
  appliedCode,
  loading = false,
}: AvailableCouponsProps) {
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([])
  const [fetching, setFetching] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    let isMounted = true
    setFetching(true)
    fetch(`/api/customer/coupons?type=${type}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AvailableCoupon[]) => {
        if (isMounted) {
          setCoupons(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => {
        if (isMounted) setCoupons([])
      })
      .finally(() => {
        if (isMounted) setFetching(false)
      })
    return () => {
      isMounted = false
    }
  }, [type])

  if (fetching || coupons.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-3.5 sm:p-4 text-slate-800 shadow-xs">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-amber-950 font-bold">
            <Ticket className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold sm:text-sm text-slate-900 flex items-center gap-1.5">
              Available Coupons
              <Badge variant="secondary" className="bg-amber-200/80 text-amber-900 border-amber-300 text-[10px] px-1.5 py-0 font-bold">
                {coupons.length} available
              </Badge>
            </h4>
            <p className="text-[11px] text-slate-600">Select a coupon to apply to your order</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-amber-200/50">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2.5 pt-2 border-t border-amber-200/60">
          {coupons.map((coupon) => {
            const isApplied = appliedCode?.toUpperCase() === coupon.code.toUpperCase()
            const meetsMinOrder = subtotal >= coupon.minOrderValue
            const discountLabel =
              coupon.discountType === "PERCENTAGE"
                ? `${coupon.discountValue}% OFF`
                : `${formatCurrency(coupon.discountValue)} OFF`

            const expiryFormatted = new Date(coupon.endDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })

            return (
              <div
                key={coupon.id}
                className={[
                  "relative flex flex-col gap-2 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:justify-between",
                  isApplied
                    ? "border-emerald-500 bg-emerald-50/70 shadow-sm"
                    : meetsMinOrder
                    ? "border-amber-300 bg-white hover:border-amber-400 hover:shadow-sm"
                    : "border-slate-200 bg-slate-50/70 opacity-80",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-amber-900">
                      <Tag className="h-3 w-3 text-amber-700" />
                      {coupon.code}
                    </span>

                    <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-emerald-500" />
                      {discountLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                    {coupon.minOrderValue > 0 ? (
                      <span className={meetsMinOrder ? "text-slate-700 font-medium" : "text-amber-800 font-medium"}>
                        Min. order: {formatCurrency(coupon.minOrderValue)}
                        {!meetsMinOrder && (
                          <span className="ml-1 text-[10px] text-amber-700 font-normal">
                            (Add {formatCurrency(coupon.minOrderValue - subtotal)} more)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-600">No minimum order required</span>
                    )}

                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">Expires {expiryFormatted}</span>
                  </div>
                </div>

                <div className="shrink-0 pt-1 sm:pt-0">
                  {isApplied ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled
                      className="h-8 bg-emerald-600 text-white text-xs font-bold gap-1 cursor-default opacity-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Applied
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading || !meetsMinOrder}
                      onClick={() => onApplyCoupon(coupon.code)}
                      className={[
                        "h-8 text-xs font-bold transition-all",
                        meetsMinOrder
                          ? "bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-xs"
                          : "bg-slate-200 text-slate-500 cursor-not-allowed",
                      ].join(" ")}
                    >
                      {loading ? "Applying..." : "Apply Coupon"}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
