import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { getCurrentSubscription } from "@/server/actions/subscriptions/get-subscription"

export default async function SellerDashboard() {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/login")
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    redirect("/register")
  }

  const subscription = await getCurrentSubscription()

  const [totalProducts, totalServices, totalOrders, totalRevenue] = await Promise.all([
    prisma.product.count({ where: { sellerId: seller.id, isActive: true } }),
    prisma.service.count({ where: { sellerId: seller.id, isActive: true } }),
    prisma.order.count({ where: { sellerId: seller.id } }),
    prisma.order.aggregate({
      where: { sellerId: seller.id },
      _sum: { subtotal: true },
    }),
  ])

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Seller Dashboard</h1>

      {!subscription && (
        <Card className="mb-8 border-destructive">
          <CardHeader>
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              You need an active subscription to use the seller dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/seller/subscription">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                Subscribe Now
              </button>
            </a>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Active products</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalProducts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>Active services</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalServices}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Total orders</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Total revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(totalRevenue._sum.subtotal || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

