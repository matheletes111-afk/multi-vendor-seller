"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { SellerCouponInput, AppliedSellerCoupon } from "@/components/seller/seller-coupon-input"
import { SellerSubscriptionHistoryTable } from "@/components/seller/seller-subscription-history-table"
import { History, Layers } from "lucide-react"

type Plan = {
  id: string
  name: string
  displayName: string
  description: string | null
  price: number
  duration?: number
  maxProducts: number | null
  maxOrders: number | null
  maxRooms: number | null
}

type Subscription = {
  id: string
  planId: string
  status: string
  currentPeriodEnd: string | null
  plan: { id: string; name: string; displayName: string }
} | null

const formatPlanDuration = (durationDays?: number) => {
  const days = durationDays || 30
  if (days === 30) return "/month"
  if (days === 90) return "/3 months"
  if (days === 180) return "/6 months"
  if (days === 365) return "/year"
  return `/${days} days`
}

export function HotelSubscriptionClient() {
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [appliedCoupons, setAppliedCoupons] = useState<Record<string, AppliedSellerCoupon | null>>({})
  const [activeTab, setActiveTab] = useState<"plans" | "history">("plans")

  useEffect(() => {
    Promise.all([
      fetch("/api/hotel-seller/subscription").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/plans?type=HOTEL").then((r) => (r.ok ? r.json() : [])),
    ]).then(([sub, p]) => { setSubscription(sub); setPlans(p) }).finally(() => setLoading(false))
  }, [])

  async function handleSubscribe(planId: string) {
    setCheckoutLoading(planId)
    const applied = appliedCoupons[planId]
    const res = await fetch("/api/hotel-seller/subscription/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        test: true,
        couponCode: applied ? applied.code : undefined
      }),
    })
    const data = await res.json().catch(() => ({}))
    setCheckoutLoading(null)
    if (data.url) window.location.href = data.url
    if (!data.url) {
      const subRes = await fetch("/api/hotel-seller/subscription")
      if (subRes.ok) setSubscription(await subRes.json())
    }
  }

  if (loading) return <PageLoader message="Loading subscription…" />

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Hotel Subscription Panel</h1>
          <p className="text-slate-500 mt-1 font-medium">Select a plan or view your past subscription history & purchases.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "plans"
                ? "bg-white text-slate-900 shadow-md dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Plans & Status
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-md dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>
      </div>

      {activeTab === "history" ? (
        <SellerSubscriptionHistoryTable />
      ) : (
        <>
          {subscription && (
            <Card className="rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-indigo-500/10 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-indigo-900">Current Plan</CardTitle>
                <CardDescription className="text-indigo-700 font-semibold">{subscription.plan.displayName}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-600">Status: <span className="font-bold text-slate-800 uppercase tracking-wider">{subscription.status}</span></p>
                {subscription.currentPeriodEnd && <p className="text-sm font-medium text-slate-600 mt-1">Renews: <span className="font-bold text-slate-800">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span></p>}
                {(subscription as any).appliedCoupon && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 w-fit">
                    <span>🎟️ Coupon Applied: <strong>{(subscription as any).appliedCoupon.code}</strong> (-{formatCurrency((subscription as any).appliedCoupon.discountAmount)})</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const applied = appliedCoupons[plan.id]
              const payablePrice = applied ? applied.finalAmount : plan.price

              return (
                <Card key={plan.id} className={`rounded-[2rem] border-2 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${subscription?.planId === plan.id ? "border-primary" : "border-slate-100"}`}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-black text-slate-800">{plan.displayName}</CardTitle>
                    <CardDescription className="font-medium text-slate-500 line-clamp-2 mt-1">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6">
                      {applied ? (
                        <div>
                          <span className="line-through text-slate-400 text-lg font-bold mr-2">{formatCurrency(plan.price)}</span>
                          <span className="text-4xl font-black text-emerald-600">{formatCurrency(payablePrice)}</span>
                          <span className="text-base font-medium text-slate-400">{formatPlanDuration(plan.duration)}</span>
                        </div>
                      ) : (
                        <p className="text-4xl font-black text-slate-800">{formatCurrency(plan.price)}{plan.price > 0 && <span className="text-base font-medium text-slate-400">{formatPlanDuration(plan.duration)}</span>}</p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6 pt-4 border-t border-slate-50 font-medium text-slate-600">
                      <li className="text-sm flex justify-between">
                        <span>Total Hotels:</span> 
                        <span className="font-bold text-slate-800">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                      </li>
                      <li className="text-sm flex justify-between">
                        <span>Total Rooms:</span> 
                        <span className="font-bold text-slate-800">{plan.maxRooms === null || plan.maxRooms === undefined ? "Unlimited" : plan.maxRooms}</span>
                      </li>
                      <li className="text-sm flex justify-between">
                        <span>Orders / Bookings:</span> 
                        <span className="font-bold text-slate-800">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/mo`}</span>
                      </li>
                    </ul>

                    {subscription?.planId !== plan.id && plan.price > 0 && (
                      <SellerCouponInput
                        amount={plan.price}
                        onCouponApplied={(coupon) => {
                          setAppliedCoupons((prev) => ({ ...prev, [plan.id]: coupon }))
                        }}
                        disabled={checkoutLoading === plan.id}
                      />
                    )}

                    <div className="mt-6">
                      {subscription?.planId !== plan.id && (
                        <Button className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs bg-slate-900 text-white hover:bg-slate-800 hover:text-white" variant="default" disabled={!!checkoutLoading} onClick={() => handleSubscribe(plan.id)}>
                          {checkoutLoading === plan.id ? "Switching..." : subscription ? "Upgrade" : "Subscribe"}
                        </Button>
                      )}
                      {subscription?.planId === plan.id && <Button disabled className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs bg-slate-100 text-slate-400">Current Plan</Button>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
