import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function SellerOrdersPage() {
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

  const orders = await prisma.order.findMany({
    where: { sellerId: seller.id },
    include: {
      customer: true,
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
      <h1 className="text-3xl font-bold mb-8">Orders</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No orders yet</p>
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
                      {order.customer.name || order.customer.email} • {formatDate(order.createdAt)}
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
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between text-sm">
                      <span>Commission ({order.commissionRate}%)</span>
                      <span className="text-destructive">-{formatCurrency(order.commission)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

