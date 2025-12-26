import { getCurrentSubscription } from "@/server/actions/subscriptions/get-subscription"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { createSubscriptionCheckout } from "@/server/actions/subscriptions/create-checkout"
import { SubscriptionPlan } from "@prisma/client"

export default async function SubscriptionPage() {
  const subscription = await getCurrentSubscription()
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
  })

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
            <p className="text-sm text-muted-foreground">
              Status: {subscription.status}
            </p>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
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
              <p className="text-3xl font-bold mb-4">
                {formatCurrency(plan.price)}
                {plan.price > 0 && <span className="text-lg font-normal">/month</span>}
              </p>
              <ul className="space-y-2 mb-6">
                <li className="text-sm">
                  Products: {plan.maxProducts === null ? "Unlimited" : plan.maxProducts}
                </li>
                <li className="text-sm">
                  Orders: {plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}
                </li>
              </ul>
              {subscription?.planId !== plan.id && (
                <form action={createSubscriptionCheckout.bind(null, plan.name)}>
                  <Button type="submit" className="w-full" variant={plan.name === "PREMIUM" ? "default" : "outline"}>
                    {subscription ? "Upgrade" : "Subscribe"}
                  </Button>
                </form>
              )}
              {subscription?.planId === plan.id && (
                <Button disabled className="w-full">
                  Current Plan
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

