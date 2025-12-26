import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Users, ShoppingBag, Package, Briefcase, ShoppingCart, DollarSign, AlertCircle, ArrowRight } from "lucide-react"

export default async function AdminDashboard() {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  const [
    totalSellers,
    totalCustomers,
    totalProducts,
    totalServices,
    totalOrders,
    totalRevenue,
    pendingSellers,
  ] = await Promise.all([
    prisma.seller.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.commission.aggregate({
      _sum: { amount: true },
    }),
    prisma.seller.count({ where: { isApproved: false } }),
  ])

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your marketplace platform
        </p>
      </div>

      {pendingSellers > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Pending Approvals</CardTitle>
            </div>
            <CardDescription>
              {pendingSellers} seller{pendingSellers !== 1 ? "s" : ""} waiting for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/admin/sellers">
              <Badge variant="destructive" className="cursor-pointer hover:bg-destructive/90">
                Review Now
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sellers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSellers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total registered sellers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total customers
            </p>
          </CardContent>
        </Card>

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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Total Orders
            </CardTitle>
            <CardDescription>All time orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Platform Revenue
            </CardTitle>
            <CardDescription>Total commissions earned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(totalRevenue._sum.amount || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/dashboard/admin/sellers">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Sellers
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  Approve, suspend, or manage sellers
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/dashboard/admin/subscriptions">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Subscriptions
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  View and manage seller subscriptions
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/dashboard/admin/categories">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Manage Categories
                  <ArrowRight className="h-4 w-4" />
                </CardTitle>
                <CardDescription>
                  Create and manage categories
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

