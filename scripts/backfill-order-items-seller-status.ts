// @ts-nocheck
import { prisma } from "../src/lib/prisma"
import { OrderStatus } from "@prisma/client"

async function run() {
  const items = await prisma.orderItem.findMany({
    where: {
      sellerId: null,
    },
    include: {
      order: { select: { status: true, commissionRate: true } },
      product: { select: { sellerId: true } },
      service: { select: { sellerId: true } },
    },
  })

  let updated = 0
  for (const item of items) {
    const sellerId = item.sellerId ?? item.product?.sellerId ?? item.service?.sellerId ?? null
    const itemStatus = (item.order?.status ?? "PENDING") as OrderStatus
    const subtotalIncl = item.subtotalInclGst ?? item.subtotal + item.gstAmount
    const commissionRateSnapshot = item.commissionRateSnapshot || item.order?.commissionRate || 0
    const commissionAmount =
      item.commissionAmount && item.commissionAmount > 0
        ? item.commissionAmount
        : (subtotalIncl + (item.shippingAmount ?? 0)) * (commissionRateSnapshot / 100)

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        sellerId,
        itemStatus,
        shippingAmount: item.shippingAmount ?? 0,
        commissionRateSnapshot,
        commissionAmount,
      },
    })
    updated += 1
  }

  console.log(`Backfill complete. Updated ${updated} order items.`)
}

run()
  .catch((err) => {
    console.error("Backfill failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

