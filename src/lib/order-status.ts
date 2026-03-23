import { OrderStatus } from "@prisma/client"

const STATUS_PRIORITY: Record<OrderStatus, number> = {
  PENDING: 10,
  CONFIRMED: 20,
  PROCESSING: 30,
  SHIPPED: 40,
  DELIVERED: 50,
  CANCELLED: 60,
  REFUNDED: 70,
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
  const hasActive = [...unique].some((s) => s !== "DELIVERED" && s !== "CANCELLED" && s !== "REFUNDED")

  if (hasDelivered && (hasActive || hasCancelled || hasRefunded)) return "PARTIALLY_DELIVERED"
  if (hasCancelled && (hasActive || hasDelivered || hasRefunded)) return "PARTIALLY_CANCELLED"
  if (hasRefunded && (hasActive || hasDelivered || hasCancelled)) return "PARTIALLY_REFUNDED"

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

