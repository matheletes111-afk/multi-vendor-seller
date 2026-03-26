/**
 * exchangeTopUpStatus is bookkeeping for the exchange price difference (often COD).
 * Shipment is not gated on this — sellers mark COMPLETED when they have collected/recorded payment.
 */
export function exchangeTopUpCodLabel(
  status: string | null | undefined,
  compact?: boolean,
): string {
  const s = (status ?? "").toUpperCase()
  if (compact) {
    if (s === "NOT_REQUIRED") return "No extra"
    if (s === "PENDING") return "COD pending"
    if (s === "COMPLETED") return "COD collected"
    return status ?? "—"
  }
  if (s === "NOT_REQUIRED") return "No extra payment"
  if (s === "PENDING") return "COD / payment pending (collect at delivery or record when received)"
  if (s === "COMPLETED") return "COD / payment collected (recorded)"
  return status ?? "—"
}
