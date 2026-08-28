"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { Badge } from "@/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Sparkles,
  Layers,
  Calendar,
  CheckCircle2,
  Tag,
  CreditCard,
  Box,
  ShoppingBag,
  Building,
  Check
} from "lucide-react"

export interface PlanSnapshotData {
  id?: string
  name?: string
  type?: string
  displayName?: string
  description?: string | null
  price?: number
  duration?: number
  maxProducts?: number | null
  maxOrders?: number | null
  maxRooms?: number | null
  features?: any
  [key: string]: any
}

export interface PlanSnapshotModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: {
    id: string
    planName?: string
    planType?: string
    price?: number
    paidPrice?: number | null
    planSnapshot?: PlanSnapshotData | null
    plan?: any
    status?: string
    createdAt?: string | Date
    currentPeriodStart?: string | Date | null
    currentPeriodEnd?: string | Date | null
    periodStart?: string | Date | null
    periodEnd?: string | Date | null
    couponCode?: string | null
    couponDiscount?: number
    finalPaidAmount?: number
    seller?: any
    isCurrent?: boolean
  } | null
}

export function PlanSnapshotModal({ isOpen, onClose, subscription }: PlanSnapshotModalProps) {
  if (!subscription) return null

  const snapshot: PlanSnapshotData =
    subscription.planSnapshot ||
    subscription.plan || {
      displayName: subscription.planName || "Subscription Plan",
      name: subscription.planType || "PLAN",
      price: subscription.price || 0,
      duration: 30,
    }

  const basePrice =
    subscription.paidPrice !== null && subscription.paidPrice !== undefined
      ? subscription.paidPrice
      : subscription.price !== undefined
        ? subscription.price
        : snapshot.price ?? 0

  const periodStart = subscription.currentPeriodStart || subscription.periodStart
  const periodEnd = subscription.currentPeriodEnd || subscription.periodEnd
  const createdDate = subscription.createdAt

  // Extract features safely
  let featuresList: string[] = []
  if (snapshot.features) {
    if (Array.isArray(snapshot.features)) {
      featuresList = snapshot.features
    } else if (typeof snapshot.features === "object") {
      featuresList = Object.entries(snapshot.features)
        .filter(([_, v]) => Boolean(v))
        .map(([k, v]) => (typeof v === "string" ? `${k}: ${v}` : k))
    }
  }

  const durationDays = snapshot.duration || 30
  const durationLabel =
    durationDays === 30
      ? "Monthly (30 Days)"
      : durationDays === 60
        ? "2 Months (60 Days)"
        : durationDays === 90
          ? "Quarterly (90 Days)"
          : durationDays === 180
            ? "Half-Yearly (180 Days)"
            : durationDays === 365
              ? "Annual (1 Year)"
              : `${durationDays} Days`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        {/* Header with gradient banner */}
        <div className="relative p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
                <Sparkles className="h-6 w-6 text-yellow-300" />
              </div>
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-100 block">
                  Purchased Plan Snapshot
                </span>
                <DialogTitle className="text-xl font-black text-white leading-tight">
                  {snapshot.displayName || snapshot.name || "Subscription"}
                </DialogTitle>
              </div>
            </div>
            <Badge className="bg-white/20 text-white hover:bg-white/30 border-white/30 backdrop-blur-md px-3 py-1 text-xs font-bold rounded-full">
              {subscription.status || "ACTIVE"}
            </Badge>
          </div>
          {snapshot.description && (
            <p className="text-xs text-indigo-100 mt-2 line-clamp-2">{snapshot.description}</p>
          )}
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Price & Billing Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Historical Price</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {formatCurrency(basePrice)}
              </span>
              <span className="text-[10px] text-slate-500 block">{durationLabel}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Final Paid</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  subscription.finalPaidAmount !== undefined
                    ? subscription.finalPaidAmount
                    : Math.max(0, basePrice - (subscription.couponDiscount || 0))
                )}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {subscription.couponCode ? `Coupon: ${subscription.couponCode}` : "No coupon"}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Plan Category</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide block truncate">
                {snapshot.type || "PRODUCT_SERVICE"}
              </span>
              <span className="text-[10px] text-slate-500 block">Tier: {snapshot.name || "CUSTOM"}</span>
            </div>
          </div>

          {/* Applied Coupon Info if present */}
          {subscription.couponCode && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-600" />
                <span>
                  Applied Coupon: <strong>{subscription.couponCode}</strong>
                </span>
              </div>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                -{formatCurrency(subscription.couponDiscount || 0)}
              </span>
            </div>
          )}

          {/* Limits & Quotas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Allocated Plan Quotas & Limits
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Box className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Max Products/Services</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {snapshot.maxProducts === null || snapshot.maxProducts === undefined
                      ? "Unlimited"
                      : `${snapshot.maxProducts} Items`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Max Orders</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {snapshot.maxOrders === null || snapshot.maxOrders === undefined
                      ? "Unlimited"
                      : `${snapshot.maxOrders} Orders`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-xl text-amber-600 dark:text-amber-400">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Max Rooms (Hotels)</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {snapshot.maxRooms === null || snapshot.maxRooms === undefined
                      ? "Unlimited"
                      : `${snapshot.maxRooms} Rooms`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Features List */}
          {featuresList.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Included Plan Features
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {featuresList.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period & Timestamps */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Validity Period:
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {periodStart && periodEnd
                  ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
                  : "Continuous / Active"}
              </span>
            </div>

            {createdDate && (
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                <span>Purchased / Activated On:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {formatDate(createdDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
