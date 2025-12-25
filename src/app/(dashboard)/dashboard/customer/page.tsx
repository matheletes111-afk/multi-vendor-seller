import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function CustomerDashboard() {
  const session = await auth()
  
  if (!session?.user || !isCustomer(session.user)) {
    redirect("/login")
  }

  const recentOrders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: {
      seller: {
        include: {
          store: true,
        },
      },
      items: {
        take: 3,
      },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">My Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Link href="/browse">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Browse Marketplace</CardTitle>
              <CardDescription>Shop products and services</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/customer/orders">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>My Orders</CardTitle>
              <CardDescription>View order history</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No orders yet</p>
              <Link href="/browse" className="mt-4 inline-block">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                  Start Shopping
                </button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        {order.seller.store?.name || "Store"} • {formatDate(order.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-sm text-muted-foreground capitalize">{order.status.toLowerCase()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

