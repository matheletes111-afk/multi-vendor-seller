import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { getCurrentSubscription } from "@/server/actions/subscriptions/get-subscription"
import Link from "next/link"
import { Package, Briefcase, ShoppingCart, DollarSign, AlertCircle, ArrowRight } from "lucide-react"

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
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your seller account
        </p>
      </div>

      {!subscription && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle>Subscription Required</AlertTitle>
          <AlertDescription className="mt-2">
            You need an active subscription to use the seller dashboard.
          </AlertDescription>
          <div className="mt-4">
            <Button asChild>
              <Link href="/dashboard/seller/subscription">
                Subscribe Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue._sum.subtotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total revenue
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

