import { PublicLayout } from "@/components/site-layout"
import { prisma } from "@/lib/prisma"
import { fastMatchSpecificZoneRegion, fastMatchProvinceRegion } from "@/lib/ai-region-matcher"
import { getZoneForRegion } from "@/lib/location-zones"
import { resolveAdministrativeRegion } from "@/lib/shipping-calculator"
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
        shippingAddressLine2: true,
        shippingPostalCode: true,
        shippingCountry: true,
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
      // Resolve structured zone label using multi-tier priority
      const specificMatch = fastMatchSpecificZoneRegion({
        addressLine1: rawOrder.shippingAddressLine1,
        addressLine2: rawOrder.shippingAddressLine2,
        city: rawOrder.shippingCity,
        state: rawOrder.shippingState,
      })

      let deliveryZoneLabel = "Other"
      if (specificMatch) {
        const zone = getZoneForRegion(specificMatch)
        deliveryZoneLabel = `${specificMatch} (${zone})`
      } else {
        const provMatch =
          fastMatchProvinceRegion({
            state: rawOrder.shippingState,
            city: rawOrder.shippingCity,
          }) || resolveAdministrativeRegion(rawOrder.shippingState)

        if (provMatch && provMatch !== "Other") {
          deliveryZoneLabel = provMatch
        }
      }

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
        shippingAddressLine2: rawOrder.shippingAddressLine2,
        shippingPostalCode: rawOrder.shippingPostalCode,
        shippingCountry: rawOrder.shippingCountry,
        deliveryZoneLabel,
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
