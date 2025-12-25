import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Sellers</CardTitle>
            <CardDescription>Total sellers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalSellers}</p>
            {pendingSellers > 0 && (
              <p className="text-sm text-destructive mt-2">
                {pendingSellers} pending approval
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Total customers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>

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
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
            <CardDescription>All time orders</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Revenue</CardTitle>
            <CardDescription>Total commissions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(totalRevenue._sum.amount || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <a href="/dashboard/admin/sellers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>Manage Sellers</CardTitle>
                <CardDescription>Approve, suspend, or manage sellers</CardDescription>
              </CardHeader>
            </Card>
          </a>
          <a href="/dashboard/admin/categories">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>Manage Categories</CardTitle>
                <CardDescription>Create and manage categories</CardDescription>
              </CardHeader>
            </Card>
          </a>
        </div>
      </div>
    </div>
  )
}

