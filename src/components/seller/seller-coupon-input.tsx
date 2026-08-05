"use client"

import { useState } from "react"
import { Tag, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { AvailableCoupons } from "@/components/coupons/available-coupons"

export interface AppliedSellerCoupon {
  id: string
  code: string
  discountType: "PERCENTAGE" | "FIXED" | string
  discountValue: number
  discountAmount: number
  finalAmount: number
}

interface SellerCouponInputProps {
  amount: number
  onCouponApplied: (coupon: AppliedSellerCoupon | null) => void
  disabled?: boolean
}

export function SellerCouponInput({ amount, onCouponApplied, disabled = false }: SellerCouponInputProps) {
  const [couponCode, setCouponCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedSellerCoupon | null>(null)

  const handleApply = async (codeToApply?: string) => {
    const targetCode = (codeToApply ?? couponCode).trim()
    if (!targetCode) return
    setCouponCode(targetCode)
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/seller/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: targetCode,
          amount
        })
      })

      const data = await res.json()

      if (res.ok && data.valid) {
        const applied: AppliedSellerCoupon = {
          id: data.coupon.id,
          code: data.coupon.code,
          discountType: data.coupon.discountType,
          discountValue: data.coupon.discountValue,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount
        }
        setAppliedCoupon(applied)
        onCouponApplied(applied)
        setErrorMsg(null)
      } else {
        setAppliedCoupon(null)
        onCouponApplied(null)
        setErrorMsg(data.error || "Invalid coupon code")
      }
    } catch (e: any) {
      console.error(e)
      setAppliedCoupon(null)
      onCouponApplied(null)
      setErrorMsg("Failed to validate coupon code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = () => {
    setCouponCode("")
    setAppliedCoupon(null)
    setErrorMsg(null)
    onCouponApplied(null)
  }

  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-indigo-500" /> Have a Coupon Code?
      </label>

      {appliedCoupon ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>
              Coupon <strong>{appliedCoupon.code}</strong> applied (-NLe {appliedCoupon.discountAmount.toFixed(2)})
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-rose-600 hover:text-rose-800 font-bold ml-2 underline text-xs"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase())
              setErrorMsg(null)
            }}
            placeholder="Enter coupon code"
            disabled={disabled || isLoading}
            className="h-10 text-xs font-mono uppercase rounded-xl border-slate-200 dark:border-slate-800"
          />
          <Button
            type="button"
            onClick={() => handleApply()}
            disabled={disabled || isLoading || !couponCode.trim()}
            variant="outline"
            className="h-10 px-4 rounded-xl text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <AvailableCoupons
        type="SELLER"
        subtotal={amount}
        onApplyCoupon={(code) => handleApply(code)}
        appliedCode={appliedCoupon?.code}
        loading={isLoading}
      />
    </div>
  )
}
