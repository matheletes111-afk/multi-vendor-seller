import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Store, ShoppingCart, ArrowRight, Package } from "lucide-react"

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
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {session.user.name || session.user.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/browse">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Shop products and services</CardDescription>
            </CardHeader>
            <CardContent>
              <Store className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/customer/orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                My Orders
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View order history</CardDescription>
            </CardHeader>
            <CardContent>
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground mb-6">
                Start shopping to see your orders here
              </p>
              <Button asChild>
                <Link href="/browse">
                  Start Shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription className="mt-1">
                        {order.seller.store?.name || "Store"} • {formatDate(order.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(order.totalAmount)}</p>
                      <Badge variant="outline" className="mt-1 capitalize">
                        {order.status.toLowerCase()}
                      </Badge>
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
