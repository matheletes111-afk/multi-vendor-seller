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
  const foodOrder = await prisma.foodOrder.findFirst({
    where: {
      id,
      customerId: authStatus.userId,
    },
  })

  if (!foodOrder) {
    return NextResponse.json({ error: "Food order not found" }, { status: 404 })
  }

  if (foodOrder.paymentStatus !== "PENDING" || foodOrder.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: "Food order is already confirmed or completed.",
      status: foodOrder.status,
      paymentStatus: foodOrder.paymentStatus,
    })
  }

  // Cancel order & release resources
  await prisma.foodOrder.update({
    where: { id: foodOrder.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      settlementStatus: "CANCELLED",
    },
  })

  // Release coupon if used
  await prisma.couponUsage.deleteMany({
    where: { foodOrderId: foodOrder.id },
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    message: "Pending food order cancelled and resources released.",
  })
}
