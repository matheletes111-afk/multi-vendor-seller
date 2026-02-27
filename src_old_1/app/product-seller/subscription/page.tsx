import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { createSubscriptionSession } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { formatCurrency } from "@/lib/utils"
import { SubscriptionPlan } from "@prisma/client"

async function getCurrentSubscription() {
  const session = await auth()
  if (!session?.user || !isSeller(session.user)) return null
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, include: { subscription: { include: { plan: true } } } })
  return seller?.subscription || null
}

async function createSubscriptionCheckout(planName: SubscriptionPlan) {
  "use server"
  const session = await auth()
  if (!session?.user || !isSeller(session.user)) redirect("/dashboard?error=unauthorized")
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, include: { subscription: { include: { plan: true } } } })
  if (!seller) redirect("/dashboard?error=seller_not_found")
  const plan = await prisma.plan.findUnique({ where: { name: planName } })
  if (!plan) redirect("/dashboard?error=plan_not_found")
  const subscriptionBase = seller.type === "PRODUCT" ? "/product-seller/subscription" : "/service-seller/subscription"
  let stripeCustomerId = seller.subscription?.stripeCustomerId || `cus_${seller.id}`
  try {
    const checkoutSession = await createSubscriptionSession({
      priceId: `price_${plan.name.toLowerCase()}`,
      customerId: stripeCustomerId,
      successUrl: `${process.env.NEXTAUTH_URL}${subscriptionBase}?success=true`,
      cancelUrl: `${process.env.NEXTAUTH_URL}${subscriptionBase}?canceled=true`,
      metadata: { sellerId: seller.id, planId: plan.id },
    })
    if (checkoutSession.url) redirect(checkoutSession.url)
    redirect(`${subscriptionBase}?error=checkout_failed`)
  } catch {
    redirect(`${subscriptionBase}?error=checkout_failed`)
  }
}

export default async function ProductSellerSubscriptionPage() {
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
