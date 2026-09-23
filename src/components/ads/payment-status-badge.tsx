"use client"

import { Badge } from "@/ui/badge"
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react"

export interface PaymentStatusBadgeProps {
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | string | null | undefined
  className?: string
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const normStatus = (status || "PENDING").toUpperCase()

  switch (normStatus) {
    case "COMPLETED":
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Paid
        </Badge>
      )
    case "PENDING":
      return (
        <Badge
          variant="outline"
          className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <Clock className="w-3 h-3 text-amber-500" />
          Unpaid
        </Badge>
      )
    case "FAILED":
      return (
        <Badge
          variant="outline"
          className={`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <AlertCircle className="w-3 h-3 text-rose-500" />
          Payment Failed
        </Badge>
      )
    case "REFUNDED":
      return (
        <Badge
          variant="outline"
          className={`bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-medium text-[11px] gap-1 px-2 py-0.5 inline-flex items-center ${className || ""}`}
        >
          <RefreshCw className="w-3 h-3 text-slate-500" />
          Refunded
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className={`text-[11px] ${className || ""}`}>
          {normStatus}
        </Badge>
      )
  }
}
