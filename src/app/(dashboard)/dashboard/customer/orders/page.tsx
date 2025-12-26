import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
import Link from "next/link"
import { ShoppingCart, Package, ArrowRight } from "lucide-react"

export default async function OrdersPage() {
  const session = await auth()
  
  if (!session?.user || !isCustomer(session.user)) {
    redirect("/login")
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: {
      seller: {
        include: {
          store: true,
        },
      },
      items: {
        include: {
          product: true,
          service: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-2">
          View and track your order history
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
          {orders.map((order) => (
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
                <Separator className="mb-4" />
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {item.product?.name || item.service?.name} × {item.quantity}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

