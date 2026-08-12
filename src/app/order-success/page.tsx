import { PublicLayout } from "@/components/site-layout"
import { prisma } from "@/lib/prisma"
import { OrderSuccessClient, type SerializedOrder } from "./order-success-client"

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }> | { orderId?: string }
}) {
  const resolvedParams = await Promise.resolve(searchParams)
  const orderId = resolvedParams?.orderId

  let order: SerializedOrder = null

  if (orderId) {
    const rawOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        shippingFullName: true,
        shippingCity: true,
        shippingState: true,
        shippingAddressLine1: true,
        shipping: true,
        weightShippingFee: true,
        dimensionShippingFee: true,
        regionShippingFee: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantity: true,
            price: true,
            subtotalInclGst: true,
          },
        },
      },
    })

    if (rawOrder) {
      order = {
        id: rawOrder.id,
        orderNumber: rawOrder.orderNumber,
        totalAmount: rawOrder.totalAmount,
        paymentMethod: rawOrder.paymentMethod ?? "COD",
        paymentStatus: String(rawOrder.paymentStatus),
        shippingFullName: rawOrder.shippingFullName,
        shippingCity: rawOrder.shippingCity,
        shippingState: rawOrder.shippingState,
        shippingAddressLine1: rawOrder.shippingAddressLine1,
        shipping: rawOrder.shipping,
        weightShippingFee: rawOrder.weightShippingFee ?? 0,
        dimensionShippingFee: rawOrder.dimensionShippingFee ?? 0,
        regionShippingFee: rawOrder.regionShippingFee ?? 0,
        createdAt: rawOrder.createdAt.toISOString(),
        items: rawOrder.items.map((i) => ({
          id: i.id,
          productNameSnapshot: i.productNameSnapshot,
          quantity: i.quantity,
          price: i.price,
          subtotalInclGst: i.subtotalInclGst,
        })),
      }
    }
  }

  return (
    <PublicLayout>
      <OrderSuccessClient order={order} />
    </PublicLayout>
  )
}
