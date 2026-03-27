import type { PrismaClient } from "@prisma/client"

/** Shown when any line on the order is already delivered and a cancel is attempted. */
export const ORDER_CANCEL_BLOCKED_DELIVERED =
  "Cannot cancel: at least one item on this order has been delivered."

type PrismaWithOrderItem = Pick<PrismaClient, "orderItem">

export async function getOrderHasDeliveredLine(
  prisma: PrismaWithOrderItem,
  orderId: string
): Promise<boolean> {
  const row = await prisma.orderItem.findFirst({
    where: { orderId, itemStatus: "DELIVERED" },
    select: { id: true },
  })
  return !!row
}
