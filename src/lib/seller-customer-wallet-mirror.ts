import type { Prisma } from "@prisma/client"

/**
 * When a customer receives wallet credit for a return/exchange, the seller’s net balance is reduced
 * and a DEBIT ledger row is recorded (idempotent per return + reason).
 */
export async function applySellerDebitForCustomerWalletCredit(
  tx: Prisma.TransactionClient,
  params: {
    sellerId: string
    returnRequestId: string
    orderId: string
    amount: number
    reason: "RETURN_REFUND" | "EXCHANGE_PRICE_DIFFERENCE"
    note: string
  }
): Promise<void> {
  const existing = await tx.sellerBalanceTransaction.findFirst({
    where: { returnRequestId: params.returnRequestId, reason: params.reason },
  })
  if (existing) return

  const rr = await tx.returnRequest.findUnique({
    where: { id: params.returnRequestId },
    select: { orderItemId: true },
  })
  if (!rr) throw new Error("Return request not found for seller balance transaction")

  await tx.seller.update({
    where: { id: params.sellerId },
    data: { netBalance: { decrement: params.amount } },
  })
  await tx.sellerBalanceTransaction.create({
    data: {
      sellerId: params.sellerId,
      amount: params.amount,
      kind: "DEBIT",
      reason: params.reason,
      returnRequestId: params.returnRequestId,
      orderItemId: rr.orderItemId,
      orderId: params.orderId,
      note: params.note,
    },
  })
}

/**
 * When the seller records exchange upgrade (top-up) collected from the customer, net balance increases.
 */
export async function applySellerCreditForExchangeTopUpCollected(
  tx: Prisma.TransactionClient,
  params: {
    sellerId: string
    returnRequestId: string
    orderId: string
    amount: number
    note: string
  }
): Promise<void> {
  const reason = "EXCHANGE_TOP_UP_COLLECTED"
  const existing = await tx.sellerBalanceTransaction.findFirst({
    where: { returnRequestId: params.returnRequestId, reason },
  })
  if (existing) return

  const rr = await tx.returnRequest.findUnique({
    where: { id: params.returnRequestId },
    select: { orderItemId: true },
  })
  if (!rr) throw new Error("Return request not found for seller balance transaction")

  await tx.seller.update({
    where: { id: params.sellerId },
    data: { netBalance: { increment: params.amount } },
  })
  await tx.sellerBalanceTransaction.create({
    data: {
      sellerId: params.sellerId,
      amount: params.amount,
      kind: "CREDIT",
      reason,
      returnRequestId: params.returnRequestId,
      orderItemId: rr.orderItemId,
      orderId: params.orderId,
      note: params.note,
    },
  })
}
