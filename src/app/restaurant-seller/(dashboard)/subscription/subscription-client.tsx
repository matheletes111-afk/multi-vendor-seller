"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"
import { SellerCouponInput, AppliedSellerCoupon } from "@/components/seller/seller-coupon-input"
import { SellerSubscriptionHistoryTable } from "@/components/seller/seller-subscription-history-table"
import { SubscriptionPaymentDialog } from "@/components/subscription/subscription-payment-dialog"
import { History, Layers, Zap } from "lucide-react"

type Plan = {
  id: string
  name: string
  displayName: string
  description: string | null
  price: number
  duration?: number
  maxProducts: number | null
  maxOrders: number | null
}

type Subscription = {
  id: string
  planId: string
  status: string
  currentPeriodEnd: string | null
  plan: { id: string; name: string; displayName: string; price: number }
} | null

const formatPlanDuration = (durationDays?: number) => {
  const days = durationDays || 30
  if (days === 30) return "/month"
  if (days === 60) return "/2 months"
  if (days === 90) return "/3 months"
  if (days === 180) return "/6 months"
  if (days === 365) return "/year"
  return `/${days} days`
}

export function RestaurantSubscriptionClient() {
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [queuedPacks, setQueuedPacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [appliedCoupons, setAppliedCoupons] = useState<Record<string, AppliedSellerCoupon | null>>({})
  const [activeTab, setActiveTab] = useState<"plans" | "history">("plans")
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<Plan | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [subRes, plansRes, historyRes] = await Promise.all([
        fetch("/api/restaurant-seller/subscription"),
        fetch("/api/plans?type=RESTAURANT"),
        fetch("/api/seller/subscription/history"),
      ])
      const subData = await subRes.json().catch(() => null)
      const plansData = await plansRes.json().catch(() => [])
      const historyData = await historyRes.json().catch(() => ({}))

      setSubscription(subData && !subData.error ? subData : null)
      setPlans(Array.isArray(plansData) ? plansData : [])
      setQueuedPacks(Array.isArray(historyData?.queuedPacks) ? historyData.queuedPacks : [])
    } catch (err) {
      console.error("Failed to load restaurant subscription data", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenPayment = (plan: Plan) => {
    setSelectedPlanForPayment(plan)
  }

  if (loading) return <PageLoader message="Loading subscription…" />

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Restaurant Subscription Panel</h1>
          <p className="text-slate-500 mt-1 font-medium">Select a prepaid recharge pack or view your past subscription history & purchases.</p>
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
                <CardDescription className="text-indigo-700 font-semibold">{subscription.plan?.displayName || "Active Plan"}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-600">Status: <span className="font-bold text-slate-800 uppercase tracking-wider">{subscription.status}</span></p>
                {subscription.currentPeriodEnd && <p className="text-sm font-medium text-slate-600 mt-1">Pack Validity End: <span className="font-bold text-slate-800">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span></p>}
                {(subscription as any).appliedCoupon && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 w-fit">
                    <span>🎟️ Coupon Applied: <strong>{(subscription as any).appliedCoupon.code}</strong> (-{formatCurrency((subscription as any).appliedCoupon.discountAmount)})</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {queuedPacks && queuedPacks.length > 0 && (
            <div className="space-y-4">
              {queuedPacks.map((qp: any) => (
                <Card key={qp.id} className="rounded-[2rem] border-2 border-dashed border-indigo-300 dark:border-indigo-700 shadow-md bg-gradient-to-r from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20">
                  <CardHeader className="py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                            Queued Pack
                          </span>
                          <CardTitle className="text-base font-bold text-indigo-950 dark:text-indigo-200">
                            {qp.planName}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-indigo-700 dark:text-indigo-400 font-medium mt-1">
                          Starts automatically on <strong>{new Date(qp.periodStart).toLocaleDateString()}</strong> (Valid for {qp.durationDays} days)
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                          Pre-Paid & Ready
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const applied = appliedCoupons[plan.id]
              const payablePrice = applied ? applied.finalAmount : plan.price
              const isCurrent = subscription?.planId === plan.id

              return (
                <Card key={plan.id} className={`rounded-[2rem] border-2 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${isCurrent ? "border-primary" : "border-slate-100"}`}>
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
                        <p className="text-4xl font-black text-slate-800">{formatCurrency(plan.price)}<span className="text-base font-medium text-slate-400">{formatPlanDuration(plan.duration)}</span></p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6 pt-4 border-t border-slate-50 font-medium text-slate-600">
                      <li className="text-sm flex justify-between">
                        <span>Listable Foods / Menu Items:</span> 
                        <span className="font-bold text-slate-800">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                      </li>
                      <li className="text-sm flex justify-between">
                        <span>Monthly Food Orders:</span> 
                        <span className="font-bold text-slate-800">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}</span>
                      </li>
                    </ul>

                    {plan.price > 0 && (
                      <SellerCouponInput
                        amount={plan.price}
                        onCouponApplied={(coupon) => {
                          setAppliedCoupons((prev) => ({ ...prev, [plan.id]: coupon }))
                        }}
                      />
                    )}

                    <div className="mt-6">
                      {isCurrent ? (
                        <Button
                          className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center justify-center gap-2"
                          onClick={() => handleOpenPayment(plan)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Extend / Queue Pack
                        </Button>
                      ) : (
                        <Button
                          className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-2"
                          onClick={() => handleOpenPayment(plan)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {subscription ? "Switch / Recharge" : "Recharge Now"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* AfriMoney Push USSD Subscription Payment Dialog */}
      <SubscriptionPaymentDialog
        open={!!selectedPlanForPayment}
        onOpenChange={(open) => !open && setSelectedPlanForPayment(null)}
        plan={selectedPlanForPayment}
        sellerType="RESTAURANT"
        currentSubscription={subscription}
        appliedCoupon={selectedPlanForPayment ? appliedCoupons[selectedPlanForPayment.id] : null}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
