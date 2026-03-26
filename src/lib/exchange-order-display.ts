/**
 * Exchange orders add a replacement line item; summing both line totals double-counts for the customer.
 * Use this helper for a simple view: original order + top-up (or wallet credit for cheaper replacement).
 */

export type ExchangeBreakdownLine = {
  id: string
  exchangeSourceOrderItemId: string | null
  subtotal: number
  hasGst: boolean
  gstAmount: number
  subtotalInclGst: number | null
  exchangeTopUpAmount?: number
  exchangeRefundDifferenceAmount?: number
  /** From return request on the original line — seller/admin records when COD/top-up is collected. */
  exchangeTopUpStatus?: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | null
}

function lineInclGst(row: ExchangeBreakdownLine): number {
  return row.subtotalInclGst ?? row.subtotal + (row.hasGst ? row.gstAmount : 0)
}

export type ExchangeOrderPriceBreakdown =
  | { kind: "standard" }
  | {
      kind: "exchange"
      originalItems: ExchangeBreakdownLine[]
      replacementItems: ExchangeBreakdownLine[]
      /** Sum of original line(s) incl. GST (what was paid at checkout for those lines). */
      originalLinesInclGst: number
      /** Replacement line total incl. GST (reference / new item value). */
      replacementLinesInclGst: number
      topUp: number
      /** Mirrors original line’s `exchangeTopUpStatus` (recorded payment vs pending). */
      topUpStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | null
      walletCredit: number
      /** Subtotal excl. GST — original lines only (for display). */
      displaySubtotal: number
      /** GST — original lines only. */
      displayTax: number
      /**
       * What the customer pays for the order in total: original lines + order shipping + top-up.
       * (Matches replacement value when upgrade; wallet credit is informational.)
       */
      effectiveGrandTotal: number
    }

export function getExchangeOrderPriceBreakdown(order: {
  items: ExchangeBreakdownLine[]
  shipping: number
}): ExchangeOrderPriceBreakdown {
  const replacementItems = order.items.filter((i) => i.exchangeSourceOrderItemId)
  if (replacementItems.length === 0) {
    return { kind: "standard" }
  }

  const sourceIds = new Set(
    replacementItems.map((i) => i.exchangeSourceOrderItemId).filter((v): v is string => !!v),
  )
  const originalItems = order.items.filter((i) => sourceIds.has(i.id))
  if (originalItems.length === 0) {
    return { kind: "standard" }
  }

  const originalLinesInclGst = originalItems.reduce((s, i) => s + lineInclGst(i), 0)
  const replacementLinesInclGst = replacementItems.reduce((s, i) => s + lineInclGst(i), 0)

  const original = originalItems[0]!
  const topUp = original.exchangeTopUpAmount ?? 0
  const walletCredit = original.exchangeRefundDifferenceAmount ?? 0

  const displaySubtotal = originalItems.reduce((s, i) => s + i.subtotal, 0)
  const displayTax = originalItems.reduce((s, i) => s + (i.hasGst ? i.gstAmount : 0), 0)

  const effectiveGrandTotal = originalLinesInclGst + order.shipping + topUp

  return {
    kind: "exchange",
    originalItems,
    replacementItems,
    originalLinesInclGst,
    replacementLinesInclGst,
    topUp,
    topUpStatus: original.exchangeTopUpStatus ?? null,
    walletCredit,
    displaySubtotal,
    displayTax,
    effectiveGrandTotal,
  }
}
