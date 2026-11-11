"use client"

import { Badge } from "@/ui/badge"
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react"

export interface PaymentStatusBadgeProps {
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | string | null | undefined
  paymentMethod?: string | null
  className?: string
}

export function PaymentStatusBadge({ status, paymentMethod, className }: PaymentStatusBadgeProps) {
  const normStatus = (status || "PENDING").toUpperCase()
  const methodUpper = (paymentMethod || "").toUpperCase()
  const isFloat = methodUpper === "FLOAT" || methodUpper === "FLOT"
  const isAfri = methodUpper === "AFRIMONEY" || methodUpper === "AFRICELL"

  const renderMethodBadge = () => {
    if (isFloat) {
      return (
        <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 rounded w-fit inline-flex items-center gap-1">
          <span>💳</span> Float (Card)
        </span>
      )
    }
    if (isAfri) {
      return (
        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded w-fit inline-flex items-center gap-1">
          <span>📱</span> AfriMoney
        </span>
      )
    }
    return null
  }

  let badgeComponent = null

  switch (normStatus) {
    case "COMPLETED":
      badgeComponent = (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Paid
        </Badge>
      )
      break
    case "PENDING":
      badgeComponent = (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <Clock className="w-3 h-3 text-amber-500" />
          Unpaid
        </Badge>
      )
      break
    case "FAILED":
      badgeComponent = (
        <Badge
          variant="outline"
          className={`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <AlertCircle className="w-3 h-3 text-rose-500" />
          Payment Failed
        </Badge>
      )
      break
    case "REFUNDED":
      badgeComponent = (
        <Badge
          variant="outline"
          className={`bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <RefreshCw className="w-3 h-3 text-slate-500" />
          Refunded
        </Badge>
      )
      break
    default:
      badgeComponent = (
        <Badge variant="secondary" className={`text-[11px] ${className || ""}`}>
          {normStatus}
        </Badge>
      )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {badgeComponent}
      {normStatus === "COMPLETED" && renderMethodBadge()}
    </div>
  )
}
