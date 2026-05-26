"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"

type Plan = { id: string; name: string; displayName: string; description: string | null; price: number; maxProducts: number | null; maxOrders: number | null }
type Subscription = { id: string; planId: string; status: string; currentPeriodEnd: string | null; plan: { displayName: string } } | null

export function HotelSubscriptionClient() {
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/hotel-seller/subscription").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/plans?type=HOTEL").then((r) => (r.ok ? r.json() : [])),
    ]).then(([sub, p]) => { setSubscription(sub); setPlans(p) }).finally(() => setLoading(false))
  }, [])

  async function handleSubscribe(planName: string) {
    setCheckoutLoading(planName)
    try {
      const res = await fetch("/api/hotel-seller/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName, test: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Checkout failed")
      
      const subRes = await fetch("/api/hotel-seller/subscription")
      if (subRes.ok) setSubscription(await subRes.json())
    } catch (error) {
      console.error(error)
    } finally {
      setCheckoutLoading(null)
    }
  }

  if (loading) return <PageLoader message="Loading subscriptions…" />

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Subscription Plans</h1>
        <p className="text-slate-500 mt-2 font-medium">Configure hotel listings and scale your capacity.</p>
      </div>

      {subscription && (
        <Card className="rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-blue-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-blue-900">Current Plan</CardTitle>
            <CardDescription className="text-blue-700 font-semibold">{subscription.plan.displayName}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-slate-600">Status: <span className="font-bold text-slate-800 uppercase tracking-wider">{subscription.status}</span></p>
            {subscription.currentPeriodEnd && <p className="text-sm font-medium text-slate-600 mt-1">Renews: <span className="font-bold text-slate-800">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span></p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={`rounded-[2rem] border-2 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${subscription?.planId === plan.id ? "border-primary" : "border-slate-100"}`}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-black text-slate-800">{plan.displayName}</CardTitle>
              <CardDescription className="font-medium text-slate-500 line-clamp-2 mt-1">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-slate-800 mb-6">{formatCurrency(plan.price)}{plan.price > 0 && <span className="text-base font-medium text-slate-400">/month</span>}</p>
              <ul className="space-y-3 mb-8 pt-4 border-t border-slate-50 font-medium text-slate-600">
                <li className="text-sm flex justify-between">
                  <span>Listable Hotels:</span> 
                  <span className="font-bold text-slate-800">{plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</span>
                </li>
                <li className="text-sm flex justify-between">
                  <span>Monthly Bookings:</span> 
                  <span className="font-bold text-slate-800">{plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}</span>
                </li>
              </ul>
              {subscription?.planId !== plan.id && (
                <Button className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs" variant={plan.name === "PREMIUM" ? "default" : "outline"} disabled={!!checkoutLoading} onClick={() => handleSubscribe(plan.name)}>
                  {checkoutLoading === plan.name ? "Switching..." : subscription ? "Upgrade" : "Subscribe"}
                </Button>
              )}
              {subscription?.planId === plan.id && <Button disabled className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs bg-slate-100 text-slate-400">Current Plan</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
