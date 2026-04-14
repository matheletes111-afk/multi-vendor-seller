import { OrderStatus } from "@prisma/client"

const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 10,
  CONFIRMED: 20,
  PROCESSING: 30,
  SHIPPED: 40,
  OUT_FOR_DELIVERY: 45,
  DELIVERED: 50,
  CANCELLED: 60,
  REFUNDED: 70,
  EXCHANGED: 75,
}

export type DerivedOrderStatus =
  | OrderStatus
  | "PARTIALLY_DELIVERED"
  | "PARTIALLY_CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "MIXED"

export function deriveOrderStatus(itemStatuses: OrderStatus[]): DerivedOrderStatus {
  if (itemStatuses.length === 0) return "PENDING"
  const unique = new Set(itemStatuses)
  if (unique.size === 1) return itemStatuses[0]

  const hasDelivered = unique.has("DELIVERED")
  const hasCancelled = unique.has("CANCELLED")
  const hasRefunded = unique.has("REFUNDED")
  const hasExchanged = unique.has("EXCHANGED")
  const terminal = new Set<OrderStatus>(["DELIVERED", "CANCELLED", "REFUNDED", "EXCHANGED"])
  const hasActive = [...unique].some((s) => !terminal.has(s))

  if (hasDelivered && (hasActive || hasCancelled || hasRefunded || hasExchanged)) return "PARTIALLY_DELIVERED"
  if (hasCancelled && (hasActive || hasDelivered || hasRefunded || hasExchanged)) return "PARTIALLY_CANCELLED"
  if ((hasRefunded || hasExchanged) && (hasActive || hasDelivered || hasCancelled)) return "PARTIALLY_REFUNDED"

  return "MIXED"
}

export function summarizeSellerItemStatuses(statuses: OrderStatus[]) {
  return {
    derivedStatus: deriveOrderStatus(statuses),
    counts: statuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {}),
    mostAdvancedStatus: [...new Set(statuses)].sort(
      (a, b) => (STATUS_PRIORITY[b] ?? 0) - (STATUS_PRIORITY[a] ?? 0)
    )[0] ?? "PENDING",
  }
}

