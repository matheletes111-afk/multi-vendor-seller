import type { Prisma } from "@prisma/client"
import { originalOrderItemLineTotalInclGst } from "@/lib/exchange-pricing"
import { applySellerDebitForCustomerWalletCredit } from "@/lib/seller-customer-wallet-mirror"

const EPS = 0.01

/**
 * Credits the customer's wallet for a normal (REFUND) return when pickup is confirmed,
 * idempotent via unique WalletTransaction.returnRequestId (same pattern as exchange price difference).
 * Deducts the same amount from the seller net balance and records a seller ledger entry.
 */
export async function creditReturnRefundToWalletOnPickup(
  tx: Prisma.TransactionClient,
  params: {
    returnRequestId: string
    customerId: string
    orderItemId: string
    sellerId: string
    orderId: string
  }
): Promise<{ creditedAmount: number }> {
  const orderItem = await tx.orderItem.findUnique({
    where: { id: params.orderItemId },
    select: {
      subtotalInclGst: true,
      subtotal: true,
      gstAmount: true,
    },
  })
  if (!orderItem) {
    throw new Error("Order item not found")
  }
  const amount = originalOrderItemLineTotalInclGst(orderItem)
  if (amount <= EPS) {
    return { creditedAmount: 0 }
  }

  const existing = await tx.walletTransaction.findUnique({
    where: { returnRequestId: params.returnRequestId },
  })
  if (existing) {
    return { creditedAmount: Number(existing.amount) }
  }

  await tx.user.update({
    where: { id: params.customerId },
    data: { walletBalance: { increment: amount } },
  })
  await tx.walletTransaction.create({
    data: {
      userId: params.customerId,
      amount,
      reason: "RETURN_REFUND",
      returnRequestId: params.returnRequestId,
      note: "Return refund: credited to wallet after pickup (item received)",
    },
  })
  await applySellerDebitForCustomerWalletCredit(tx, {
    sellerId: params.sellerId,
    returnRequestId: params.returnRequestId,
    orderId: params.orderId,
    amount,
    reason: "RETURN_REFUND",
    note: "Customer wallet credit for return refund (after pickup)",
  })
  return { creditedAmount: amount }
}
