import type { Prisma } from "@prisma/client"
import type { OrderStatus } from "@prisma/client"

/** Kept for API compatibility if we reintroduce optional checks later. */
export class ExchangeTopUpRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExchangeTopUpRequiredError"
  }
}

/**
 * Exchange replacements use the same shipment statuses as any other line.
 * `exchangeTopUpStatus === COMPLETED` means the seller recorded COD/payment for the price difference — not a prereq to ship.
 */
export async function assertExchangeReplacementCanAdvance(
  _tx: Prisma.TransactionClient,
  _orderItemId: string,
  _nextStatus: OrderStatus
): Promise<void> {
  return
}
