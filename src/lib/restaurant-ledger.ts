import type { Prisma } from "@prisma/client"

export const RESTAURANT_REVENUE_REASON_ORDER_DELIVERED = "ORDER_DELIVERED"

export async function creditRestaurantSellerForDelivery(
  tx: Prisma.TransactionClient,
  foodOrderId: string
): Promise<void> {
  const order = await tx.foodOrder.findUnique({
    where: { id: foodOrderId }
  })

  if (!order) return
  if (order.status !== "DELIVERED") return

  const restaurantSellerId = order.restaurantSellerId

  // Check if already credited
  const existing = await tx.restaurantBalanceTransaction.findFirst({
    where: {
      foodOrderId,
      reason: RESTAURANT_REVENUE_REASON_ORDER_DELIVERED
    }
  })
  if (existing) return

  const amount = order.totalAmount

  // Increment seller netBalance
  await tx.restaurantSeller.update({
    where: { id: restaurantSellerId },
    data: {
      netBalance: { increment: amount }
    }
  })

  // Create ledger entry
  await tx.restaurantBalanceTransaction.create({
    data: {
      restaurantSellerId,
      amount,
      kind: "CREDIT",
      reason: RESTAURANT_REVENUE_REASON_ORDER_DELIVERED,
      foodOrderId,
      note: `Credited for order delivery: #${order.orderNumber}`
    }
  })
}
