import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import Link from "next/link"
import { ShoppingCart, ArrowRight } from "lucide-react"
import { OrdersListClient } from "./orders-list-client"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) return null

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: {
      seller: {
        include: {
          store: true,
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          serviceId: true,
          productNameSnapshot: true,
          serviceNameSnapshot: true,
          quantity: true,
          subtotal: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const serializedOrders = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    totalAmount: order.totalAmount,
    status: order.status,
    seller: order.seller
      ? {
          store: order.seller.store ? { name: order.seller.store.name } : null,
        }
      : { store: null },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      serviceId: item.serviceId,
      productNameSnapshot: item.productNameSnapshot,
      serviceNameSnapshot: item.serviceNameSnapshot,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
  }))

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-1">
          View and track your order history. Switch between product and service orders.
        </p>
      </div>

      {serializedOrders.length === 0 ? (
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
        <OrdersListClient orders={serializedOrders} />
      )}
    </div>
  )
}
