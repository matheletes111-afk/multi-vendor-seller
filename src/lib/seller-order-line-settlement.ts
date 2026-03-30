import type { Prisma } from "@prisma/client"
import { originalOrderItemLineTotalInclGst, roundMoney } from "@/lib/exchange-pricing"

const EPS = 0.01

/** Ledger reason: seller net credited when a product/service line is marked delivered. */
export const SELLER_BALANCE_REASON_ORDER_LINE_DELIVERED = "ORDER_LINE_DELIVERED"

/**
 * Credits the seller’s platform net balance when an order line is fulfilled (delivered).
 * Net = line total incl. GST + allocated shipping − commission (matches checkout).
 * Idempotent per order line via `orderItemId` + reason.
 */
export async function applySellerCreditForOrderLineDelivered(
  tx: Prisma.TransactionClient,
  orderItemId: string
): Promise<void> {
  const existing = await tx.sellerBalanceTransaction.findFirst({
    where: {
      orderItemId,
      reason: SELLER_BALANCE_REASON_ORDER_LINE_DELIVERED,
    },
  })
  if (existing) return

  const item = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      productId: true,
      serviceId: true,
      subtotalInclGst: true,
      subtotal: true,
      gstAmount: true,
      shippingAmount: true,
      itemStatus: true,
    },
  })
  if (!item?.sellerId || item.itemStatus !== "DELIVERED") return
  if (!item.productId && !item.serviceId) return

  const lineIncl = originalOrderItemLineTotalInclGst(item)
  const creditAmount = roundMoney(lineIncl + item.shippingAmount)
  if (creditAmount <= EPS) return

  await tx.seller.update({
    where: { id: item.sellerId },
    data: { netBalance: { increment: creditAmount } },
  })
  await tx.sellerBalanceTransaction.create({
    data: {
      sellerId: item.sellerId,
      amount: creditAmount,
      kind: "CREDIT",
      reason: SELLER_BALANCE_REASON_ORDER_LINE_DELIVERED,
      orderItemId: item.id,
      orderId: item.orderId,
      note: "Seller credit when line marked delivered (line incl. GST + shipping)",
    },
  })
}
