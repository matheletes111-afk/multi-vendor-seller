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

  const [seller, globalSetting] = await Promise.all([
    tx.restaurantSeller.findUnique({
      where: { id: restaurantSellerId },
      select: { commissionRate: true },
    }),
    (tx as any).globalSetting.findFirst({
      select: { baseCommission: true, restaurantBaseCommission: true },
    }) as Promise<{ baseCommission?: number; restaurantBaseCommission?: number } | null>,
  ])

  const commissionPct =
    seller?.commissionRate ??
    globalSetting?.restaurantBaseCommission ??
    globalSetting?.baseCommission ??
    10.0

  const grossAmount = order.totalAmount
  const commissionAmount = Math.round(grossAmount * (commissionPct / 100) * 100) / 100
  const netAmount = Math.max(0, Math.round((grossAmount - commissionAmount) * 100) / 100)

  // Increment seller netBalance with net amount after commission
  await tx.restaurantSeller.update({
    where: { id: restaurantSellerId },
    data: {
      netBalance: { increment: netAmount }
    }
  })

  // Create ledger entry
  await tx.restaurantBalanceTransaction.create({
    data: {
      restaurantSellerId,
      amount: netAmount,
      kind: "CREDIT",
      reason: RESTAURANT_REVENUE_REASON_ORDER_DELIVERED,
      foodOrderId,
      note: `Credited for order delivery: #${order.orderNumber} (Gross: $${grossAmount.toFixed(2)}, Commission ${commissionPct}%: -$${commissionAmount.toFixed(2)})`
    }
  })
}

