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
      commissionAmount: true,
      itemStatus: true,
      isSelfDelivery: true,
    },
  })
  if (!item?.sellerId || item.itemStatus !== "DELIVERED") return
  if (!item.productId && !item.serviceId) return

  const lineIncl = originalOrderItemLineTotalInclGst(item)
  const comm = typeof item.commissionAmount === "number" ? item.commissionAmount : 0
  const isSelf = Boolean(item.isSelfDelivery)
  const shippingFee = item.productId ? (item.shippingAmount || 0) : 0

  // For Self-Delivery: Seller fulfilled delivery in-house, so customer delivery charge is added to seller wallet.
  // For Platform Rider: Delivery charge is deducted to compensate platform rider.
  const creditAmount = roundMoney(
    isSelf
      ? Math.max(0, lineIncl + shippingFee - comm)
      : Math.max(0, lineIncl - comm - shippingFee)
  )
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
      note: item.productId
        ? isSelf
          ? `Seller net credit: Item incl. GST (${roundMoney(lineIncl)}) + delivery charge credited (${roundMoney(shippingFee)}) − platform commission (${roundMoney(comm)}) [Self-Delivery Fulfilled]`
          : `Seller net credit: Item incl. GST (${roundMoney(lineIncl)}) − platform commission (${roundMoney(comm)}) − delivery boy charge (${roundMoney(shippingFee)})`
        : `Seller net credit: Service line incl. GST (${roundMoney(lineIncl)}) − platform commission (${roundMoney(comm)})`,
    },
  })
}
