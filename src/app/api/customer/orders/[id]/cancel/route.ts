import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { releaseServiceSlotsForOrderItems } from "@/lib/release-service-slot"

/** POST /api/customer/orders/[id]/cancel — cancel own order if all items are still PENDING. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: session.user.id },
    include: {
      items: {
        select: {
          id: true,
          itemStatus: true,
          productVariantId: true,
          quantity: true,
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.items.length === 0) return NextResponse.json({ error: "No items found for this order" }, { status: 400 })
  if (order.items.some((item) => item.itemStatus !== "PENDING")) {
    return NextResponse.json({ error: "Only orders with all items in PENDING can be cancelled" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({
      where: { orderId: order.id },
      data: { itemStatus: "CANCELLED" },
    })
    await tx.orderItemStatusHistory.createMany({
      data: order.items.map((item) => ({
        orderItemId: item.id,
        status: "CANCELLED",
        note: "Cancelled by customer",
      })),
    })
    for (const item of order.items) {
      if (item.productVariantId) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }
    await releaseServiceSlotsForOrderItems(
      tx,
      order.items.map((i) => i.id)
    )
  })

  return NextResponse.json({ success: true })
}

