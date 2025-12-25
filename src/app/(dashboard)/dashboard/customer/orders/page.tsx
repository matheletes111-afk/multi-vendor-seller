import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"

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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No orders yet</p>
            <a href="/browse" className="inline-block">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                Start Shopping
              </button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
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
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.product?.name || item.service?.name} x {item.quantity}
                      </span>
                      <span>{formatCurrency(item.subtotal)}</span>
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

