/** Gross line value for a service order item (incl. GST + shipping allocation on the line). */
export function serviceSellerLineGross(item: {
  subtotalInclGst: number | null
  subtotal: number
  gstAmount: number
  shippingAmount: number
}): number {
  return (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount
}

/** Seller’s share for their lines: gross minus platform commission on those lines. */
export function serviceSellerItemsNet(
  items: Array<{
    subtotalInclGst: number | null
    subtotal: number
    gstAmount: number
    shippingAmount: number
    commissionAmount: number
  }>
): number {
  const gross = items.reduce((s, i) => s + serviceSellerLineGross(i), 0)
  const commission = items.reduce((s, i) => s + i.commissionAmount, 0)
  return gross - commission
}
