import type { Prisma } from "@prisma/client"
import {
  EXCHANGE_COMMISSION_RATE,
  computeExchangePriceAdjustment,
  computeProductVariantLineTotals,
  originalOrderItemLineTotalInclGst,
  roundMoney,
} from "@/lib/exchange-pricing"

export type ExchangeReplacementResult = {
  id: string
  exchangeTopUpAmount: number
  exchangeTopUpStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED"
  exchangeRefundDifferenceAmount: number
  exchangeRefundDifferenceStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED"
}

/**
 * Creates replacement line at current variant pricing; computes top-up vs refund difference vs original line.
 */
export async function createExchangeReplacementOrderItem(
  tx: Prisma.TransactionClient,
  params: { originalOrderItemId: string; replacementVariantId: string; sellerId: string }
): Promise<ExchangeReplacementResult> {
  const original = await tx.orderItem.findFirst({
    where: { id: params.originalOrderItemId, sellerId: params.sellerId },
    include: {
      product: { select: { id: true, name: true } },
    },
  })
  if (!original?.productId || !original.product) {
    throw new Error("Invalid order item for exchange")
  }

  const repVariant = await tx.productVariant.findFirst({
    where: {
      id: params.replacementVariantId,
      productId: original.productId,
    },
  })
  if (!repVariant) throw new Error("Replacement variant not found for this product")
  if (repVariant.id === original.productVariantId) throw new Error("Replacement must be a different variant")
  if (repVariant.stock < original.quantity) throw new Error("Insufficient stock for the selected replacement variant")

  const oldIncl = originalOrderItemLineTotalInclGst(original)
  const newTotals = computeProductVariantLineTotals(repVariant, original.quantity)
  const { exchangeTopUpAmount, exchangeRefundDifferenceAmount } = computeExchangePriceAdjustment(
    oldIncl,
    newTotals.totalPriceInclGst
  )

  let exchangeTopUpStatus: ExchangeReplacementResult["exchangeTopUpStatus"] = "NOT_REQUIRED"
  let exchangeRefundDifferenceStatus: ExchangeReplacementResult["exchangeRefundDifferenceStatus"] = "NOT_REQUESTED"
  if (exchangeTopUpAmount > 0) {
    exchangeTopUpStatus = "PENDING"
  }
  if (exchangeRefundDifferenceAmount > 0) {
    // Credited to customer wallet when replacement is delivered (see exchange-completion).
    exchangeRefundDifferenceStatus = "PENDING"
  }

  const productName = `${original.product.name} (${repVariant.name})`
  const lineTotalInclGst = roundMoney(newTotals.totalPriceInclGst)
  const itemShippingAmount = 0
  const commissionAmount = roundMoney(
    ((lineTotalInclGst + itemShippingAmount) * EXCHANGE_COMMISSION_RATE) / 100
  )

  const created = await tx.orderItem.create({
    data: {
      orderId: original.orderId,
      sellerId: original.sellerId,
      productId: original.productId,
      productVariantId: repVariant.id,
      productNameSnapshot: productName,
      serviceNameSnapshot: null,
      quantity: original.quantity,
      price: roundMoney(newTotals.unitPrice),
      subtotal: roundMoney(newTotals.totalPrice),
      hasGst: newTotals.hasGst,
      gstAmount: roundMoney(newTotals.totalGst),
      subtotalInclGst: lineTotalInclGst,
      itemStatus: "PENDING",
      shippingAmount: itemShippingAmount,
      commissionAmount,
      commissionRateSnapshot: EXCHANGE_COMMISSION_RATE,
      exchangeSourceOrderItemId: original.id,
    },
  })

  await tx.orderItemStatusHistory.create({
    data: {
      orderItemId: created.id,
      status: "PENDING",
      note: "Exchange replacement — awaiting fulfillment",
    },
  })

  await tx.productVariant.update({
    where: { id: repVariant.id },
    data: { stock: { decrement: original.quantity } },
  })

  return {
    id: created.id,
    exchangeTopUpAmount,
    exchangeTopUpStatus,
    exchangeRefundDifferenceAmount,
    exchangeRefundDifferenceStatus,
  }
}
