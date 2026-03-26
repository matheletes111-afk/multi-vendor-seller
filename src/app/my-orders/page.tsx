import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { PublicLayout } from "@/components/site-layout"
import { MyOrdersClient } from "./my-orders-client"
import { deriveOrderStatus } from "@/lib/order-status"

export default async function MyOrdersPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/customer/login?callbackUrl=" + encodeURIComponent("/my-orders"))
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    redirect("/")
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    include: {
      seller: { include: { store: true } },
      items: {
        select: {
          id: true,
          productId: true,
          serviceId: true,
          productVariantId: true,
          productNameSnapshot: true,
          serviceNameSnapshot: true,
          quantity: true,
          subtotal: true,
          itemStatus: true,
          productVariant: {
            select: {
              returnType: true,
              returnDays: true,
              replacementAllowed: true,
            },
          },
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
    status: deriveOrderStatus(order.items.map((i) => i.itemStatus)),
    seller: order.seller
      ? { store: order.seller.store ? { name: order.seller.store.name } : null }
      : { store: null },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      serviceId: item.serviceId,
      productVariantId: item.productVariantId,
      productNameSnapshot: item.productNameSnapshot,
      serviceNameSnapshot: item.serviceNameSnapshot,
      quantity: item.quantity,
      subtotal: item.subtotal,
      itemStatus: item.itemStatus,
      returnPolicyType: item.productVariant?.returnType ?? null,
      returnPolicyDays: item.productVariant?.returnDays ?? null,
      replacementAllowed: item.productVariant?.replacementAllowed === true,
    })),
  }))

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <MyOrdersClient orders={serializedOrders} />
        </div>
      </div>
    </PublicLayout>
  )
}
