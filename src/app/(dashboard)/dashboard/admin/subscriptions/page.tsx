import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function AdminSubscriptionsPage() {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const [subscriptions, plans, stats] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        seller: {
          include: {
            user: true,
            store: true,
          },
        },
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      orderBy: { price: "asc" },
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      _count: true,
    }),
  ])

  const activeSubscriptions = subscriptions.filter(s => s.status === "ACTIVE").length
  const totalRevenue = subscriptions
    .filter(s => s.status === "ACTIVE")
    .reduce((sum, s) => sum + s.plan.price, 0)

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Subscriptions</CardTitle>
            <CardDescription>All subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{subscriptions.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active</CardTitle>
            <CardDescription>Currently active</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{activeSubscriptions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>From active subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>Available plans</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{plans.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Plans */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Subscription Plans</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const planSubscriptions = subscriptions.filter(s => s.planId === plan.id)
            const activeCount = planSubscriptions.filter(s => s.status === "ACTIVE").length

            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{plan.displayName}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <Link href={`/dashboard/admin/subscriptions/edit/${plan.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {formatCurrency(plan.price)}
                      {plan.price > 0 && <span className="text-lg font-normal">/month</span>}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>Products: {plan.maxProducts === null ? "Unlimited" : plan.maxProducts}</p>
                      <p>Orders: {plan.maxOrders === null ? "Unlimited" : `${plan.maxOrders}/month`}</p>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <p className="text-sm text-muted-foreground">
                        {activeCount} active subscriptions
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {planSubscriptions.length} total subscriptions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* All Subscriptions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">All Subscriptions</h2>
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No subscriptions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <Card key={subscription.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>
                        {subscription.seller.store?.name || subscription.seller.user.email}
                      </CardTitle>
                      <CardDescription>
                        {subscription.seller.user.email} • {subscription.plan.displayName} Plan
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          subscription.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : subscription.status === "CANCELED"
                            ? "bg-gray-100 text-gray-800"
                            : subscription.status === "PAST_DUE"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {subscription.status}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Plan Price</p>
                      <p className="font-medium">{formatCurrency(subscription.plan.price)}/month</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{formatDate(subscription.createdAt)}</p>
                    </div>
                    {subscription.currentPeriodStart && (
                      <div>
                        <p className="text-muted-foreground">Period Start</p>
                        <p className="font-medium">{formatDate(subscription.currentPeriodStart)}</p>
                      </div>
                    )}
                    {subscription.currentPeriodEnd && (
                      <div>
                        <p className="text-muted-foreground">Period End</p>
                        <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                      </div>
                    )}
                  </div>
                  {subscription.stripeSubscriptionId && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Stripe ID: {subscription.stripeSubscriptionId}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

