import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileCustomerAuth(request)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: {
      id,
      customerId: authStatus.userId,
    },
    include: {
      items: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Only cancel if payment is still pending
  if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: "Order is already completed or processed.",
      status: order.status,
      paymentStatus: order.paymentStatus,
    })
  }

  // Mark order & items as CANCELLED
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
    },
  })

  await prisma.orderItem.updateMany({
    where: { orderId: order.id },
    data: {
      itemStatus: "CANCELLED",
      settlementStatus: "CANCELLED",
    },
  })

  // Restore inventory stock and service slots
  for (const item of order.items) {
    if (item.productVariantId) {
      await prisma.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      }).catch(() => null)
    }
    if (item.serviceSlotId) {
      await prisma.serviceSlot.update({
        where: { id: item.serviceSlotId },
        data: { isBooked: false },
      }).catch(() => null)
    }
  }

  // Release coupon if used
  await prisma.couponUsage.deleteMany({
    where: { orderId: order.id },
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    message: "Pending order cancelled and resources released.",
  })
}
