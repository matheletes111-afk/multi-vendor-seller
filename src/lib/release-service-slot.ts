import type { Prisma } from "@prisma/client"

/**
 * Clears serviceSlotId on the given order items and deletes the linked ServiceSlot rows
 * so those times become available again in getAvailableServiceSlotsList.
 */
export async function releaseServiceSlotsForOrderItems(
  tx: Prisma.TransactionClient,
  orderItemIds: string[]
): Promise<void> {
  if (orderItemIds.length === 0) return
  const items = await tx.orderItem.findMany({
    where: { id: { in: orderItemIds } },
    select: { serviceSlotId: true },
  })
  const slotIds = [...new Set(items.map((i) => i.serviceSlotId).filter((id): id is string => id != null))]
  if (slotIds.length === 0) return

  await tx.orderItem.updateMany({
    where: { id: { in: orderItemIds } },
    data: { serviceSlotId: null },
  })

  for (const slotId of slotIds) {
    try {
      await tx.serviceSlot.delete({ where: { id: slotId } })
    } catch {
      /* slot already removed or concurrent update */
    }
  }
}
