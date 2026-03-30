import { Prisma } from "@prisma/client"
import { applySellerDebitForCustomerWalletCredit } from "@/lib/seller-customer-wallet-mirror"

const EPS = 0.01

/**
 * When a replacement exchange line is marked DELIVERED, complete the linked return:
 * credit wallet for cheaper replacement (if any), then pickup COMPLETED, original line EXCHANGED,
 * restock original variant. Idempotent.
 */
export async function completeExchangeOnReplacementDelivered(
  tx: Prisma.TransactionClient,
  replacementOrderItemId: string
): Promise<void> {
  const replacement = await tx.orderItem.findUnique({
    where: { id: replacementOrderItemId },
    select: {
      id: true,
      exchangeSourceOrderItemId: true,
      itemStatus: true,
    },
  })
  if (!replacement?.exchangeSourceOrderItemId || replacement.itemStatus !== "DELIVERED") return

  const sourceId = replacement.exchangeSourceOrderItemId

  const rr = await tx.returnRequest.findUnique({
    where: { orderItemId: sourceId },
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      resolutionType: true,
      pickupStatus: true,
      customerId: true,
      exchangeRefundDifferenceAmount: true,
      exchangeRefundDifferenceStatus: true,
    },
  })
  if (!rr || rr.resolutionType !== "EXCHANGE" || rr.pickupStatus === "COMPLETED") return

  const diffAmount = rr.exchangeRefundDifferenceAmount ?? 0
  const pendingWallet =
    diffAmount > EPS && rr.exchangeRefundDifferenceStatus === "PENDING"

  if (pendingWallet) {
    const existing = await tx.walletTransaction.findUnique({
      where: { returnRequestId: rr.id },
    })
    if (!existing) {
      // Create wallet transaction first so concurrent completion cannot double-credit.
      try {
        await tx.walletTransaction.create({
          data: {
            userId: rr.customerId,
            amount: diffAmount,
            reason: "EXCHANGE_PRICE_DIFFERENCE",
            returnRequestId: rr.id,
            note: "Exchange: price difference for cheaper replacement (credited on delivery)",
          },
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          // Already credited in another concurrent request; continue to mark statuses below.
        } else {
          throw e
        }
      }

      // Only increment balances and debit seller when we successfully created the wallet transaction row.
      // If the create raced and lost, the unique constraint path above will skip these.
      const created = await tx.walletTransaction.findUnique({ where: { returnRequestId: rr.id } })
      if (created) {
        await tx.user.update({
          where: { id: rr.customerId },
          data: { walletBalance: { increment: diffAmount } },
        })
        await applySellerDebitForCustomerWalletCredit(tx, {
          sellerId: rr.sellerId,
          returnRequestId: rr.id,
          orderId: rr.orderId,
          amount: diffAmount,
          reason: "EXCHANGE_PRICE_DIFFERENCE",
          note: "Customer wallet credit for cheaper exchange (replacement delivered)",
        })
      }
    }
    await tx.returnRequest.update({
      where: { id: rr.id },
      data: { exchangeRefundDifferenceStatus: "COMPLETED" },
    })
  }

  const sourceItem = await tx.orderItem.findUnique({
    where: { id: sourceId },
    select: { id: true, productVariantId: true, quantity: true },
  })
  if (!sourceItem?.productVariantId) return

  await tx.returnRequest.update({
    where: { id: rr.id },
    data: { pickupStatus: "COMPLETED" },
  })
  await tx.orderItem.update({
    where: { id: sourceId },
    data: { itemStatus: "EXCHANGED" },
  })
  await tx.orderItemStatusHistory.create({
    data: {
      orderItemId: sourceId,
      status: "EXCHANGED",
      note: "Exchange completed: replacement delivered",
    },
  })
  await tx.productVariant.update({
    where: { id: sourceItem.productVariantId },
    data: { stock: { increment: sourceItem.quantity } },
  })
}
