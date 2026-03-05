"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { PageLoader } from "@/components/ui/page-loader"

type Plan = { id: string; name: string; displayName: string; description: string | null; price: number; maxProducts: number | null; maxOrders: number | null }
type Subscription = { id: string; planId: string; status: string; currentPeriodEnd: string | null; plan: { displayName: string } } | null

export function SubscriptionClient() {
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/product-seller/subscription").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/plans").then((r) => (r.ok ? r.json() : [])),
    ]).then(([sub, p]) => { setSubscription(sub); setPlans(p) }).finally(() => setLoading(false))
  }, [])

  async function handleSubscribe(planName: string) {
    setCheckoutLoading(planName)
    const res = await fetch("/api/product-seller/subscription/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planName }),
    })
    const data = await res.json().catch(() => ({}))
    setCheckoutLoading(null)
    if (data.url) window.location.href = data.url
  }

  if (loading) return <PageLoader message="Loading subscription…" />

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Subscription Plans</h1>
      {subscription && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>{subscription.plan.displayName}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Status: {subscription.status}</p>
            {subscription.currentPeriodEnd && <p className="text-sm text-muted-foreground">Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={subscription?.planId === plan.id ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>{plan.displayName}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold mb-4">{formatCurrency(plan.price)}{plan.price > 0 && <span className="text-lg font-normal">/month</span>}</p>
              <ul className="space-y-2 mb-6">
                <li className="text-sm">Products: {plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</li>
                <li className="text-sm">Orders: {plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}</li>
              </ul>
              {subscription?.planId !== plan.id && (
                <Button className="w-full" variant={plan.name === "PREMIUM" ? "default" : "outline"} disabled={!!checkoutLoading} onClick={() => handleSubscribe(plan.name)}>
                  {checkoutLoading === plan.name ? "Redirecting..." : subscription ? "Upgrade" : "Subscribe"}
                </Button>
              )}
              {subscription?.planId === plan.id && <Button disabled className="w-full">Current Plan</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
