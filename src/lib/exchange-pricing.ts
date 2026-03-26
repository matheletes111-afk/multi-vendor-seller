/** Match `src/app/api/customer/cart/resolve.ts` GST and unit price rules. */
const GST_RATE = 0.15

export const EXCHANGE_COMMISSION_RATE = 10

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeProductVariantLineTotals(
  variant: { price: number; discount: number; hasGst: boolean },
  quantity: number
): {
  unitPrice: number
  hasGst: boolean
  totalPrice: number
  totalGst: number
  totalPriceInclGst: number
} {
  const unitPrice = Math.max(0, variant.price - (variant.discount ?? 0))
  const hasGst = variant.hasGst ?? true
  const totalPrice = unitPrice * quantity
  const totalGst = hasGst ? totalPrice * GST_RATE : 0
  const totalPriceInclGst = totalPrice + totalGst
  return { unitPrice, hasGst, totalPrice, totalGst, totalPriceInclGst }
}

export function originalOrderItemLineTotalInclGst(item: {
  subtotalInclGst: number | null
  subtotal: number
  gstAmount: number
}): number {
  return item.subtotalInclGst ?? item.subtotal + item.gstAmount
}

const EPS = 0.01

export function computeExchangePriceAdjustment(
  originalLineInclGst: number,
  replacementLineInclGst: number
): {
  exchangeTopUpAmount: number
  exchangeRefundDifferenceAmount: number
} {
  const diff = roundMoney(replacementLineInclGst - originalLineInclGst)
  if (diff > EPS) {
    return { exchangeTopUpAmount: diff, exchangeRefundDifferenceAmount: 0 }
  }
  if (diff < -EPS) {
    return { exchangeTopUpAmount: 0, exchangeRefundDifferenceAmount: roundMoney(-diff) }
  }
  return { exchangeTopUpAmount: 0, exchangeRefundDifferenceAmount: 0 }
}
