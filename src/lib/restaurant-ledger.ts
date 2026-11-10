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

  const grossAmount = order.subtotal > 0 ? order.subtotal : order.totalAmount
  const commissionAmount = typeof order.commissionAmount === "number" && order.commissionAmount > 0
    ? order.commissionAmount
    : Math.round(grossAmount * (commissionPct / 100) * 100) / 100
  const netAmount = typeof order.sellerNetPayout === "number" && order.sellerNetPayout > 0
    ? order.sellerNetPayout
    : Math.max(0, Math.round((grossAmount - commissionAmount) * 100) / 100)

  const isPrepaid = order.paymentMethod === "AFRIMONEY"
  const newSettlementStatus = isPrepaid ? "YET_TO_PAY" : "COD_COLLECTED_BY_SELLER"

  await tx.foodOrder.update({
    where: { id: order.id },
    data: {
      settlementStatus: newSettlementStatus,
      sellerNetPayout: netAmount,
      commissionAmount: commissionAmount,
      commissionRate: commissionPct,
    },
  })

  // ONLY increment seller netBalance and create CREDIT transaction if prepaid (AfriMoney).
  // For Restaurant COD, restaurant staff collects cash directly from the customer.
  // The platform does NOT hold the funds and does NOT owe a payout liability to the restaurant.
  if (isPrepaid) {
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
}

