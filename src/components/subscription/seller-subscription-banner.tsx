"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AlertCircle, Clock, ArrowRight, ShieldAlert, Sparkles, X } from "lucide-react"
import { Button } from "@/ui/button"

export interface SellerSubscriptionBannerProps {
  sellerType: "product-seller" | "service-seller" | "hotel-seller" | "restaurant-seller"
}

export function SellerSubscriptionBanner({ sellerType }: SellerSubscriptionBannerProps) {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchSub() {
      try {
        const res = await fetch(`/api/${sellerType}/subscription`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) setSubscription(data)
        }
      } catch {
        // silent fail
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchSub()
    return () => {
      isMounted = false
    }
  }, [sellerType])

  if (loading || !subscription || isDismissed) return null

  const now = new Date()
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null
  const status = (subscription.status || "").toUpperCase()
  const planName = subscription.plan?.displayName || subscription.plan?.name || "Subscription Pack"

  // Days left calculation
  const msLeft = periodEnd ? periodEnd.getTime() - now.getTime() : 0
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000))

  const isExpired =
    status === "EXPIRED" ||
    status === "CANCELED" ||
    (periodEnd !== null && msLeft <= 0)

  const isExpiringSoon = !isExpired && (status === "ACTIVE" || status === "TRIALING") && daysLeft <= 7 && daysLeft >= 0

  const rechargeUrl = `/${sellerType}/subscription`

  // State 1: EXPIRED (Red Persistent Alert)
  if (isExpired) {
    return (
      <div className="bg-rose-600 text-white px-4 py-3 shadow-md relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0 text-white" />
            <div className="text-xs sm:text-sm">
              <span className="font-black">Subscription Expired: </span>
              <span>
                Your store listings are currently hidden from customers on the marketplace.{" "}
                <span className="font-semibold underline decoration-white/50">
                  (In-flight order guarantee: You can still view, manage, and dispatch all pending orders).
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={rechargeUrl}>
              <Button
                size="sm"
                className="bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl shadow-sm h-8"
              >
                Recharge via AfriMoney
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // State 2: EXPIRING SOON (Amber Warning Banner)
  if (isExpiringSoon) {
    return (
      <div className="bg-amber-500 text-slate-950 px-4 py-2.5 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <Clock className="w-4 h-4 shrink-0 text-slate-950" />
            <div>
              <span className="font-black">
                {daysLeft === 0
                  ? "Your subscription expires today! "
                  : `Subscription expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}! `}
              </span>
              <span className="font-medium text-slate-900">
                ({planName} valid until {periodEnd?.toLocaleDateString()}). Recharge now to avoid any interruption to your store visibility.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={rechargeUrl}>
              <Button
                size="sm"
                className="bg-slate-950 text-white hover:bg-slate-900 font-bold text-xs rounded-xl h-7"
              >
                Extend / Queue Pack
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-900/70 hover:text-slate-950 p-1"
              title="Dismiss warning for this session"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

