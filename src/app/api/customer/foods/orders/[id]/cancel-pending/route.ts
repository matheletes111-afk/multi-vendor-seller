import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function resolveCustomerUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id

  const mobileAuth = await getMobileCustomerAuth(request)
  if (mobileAuth.ok) return mobileAuth.userId

  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const customerId = await resolveCustomerUserId(request)
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const foodOrder = await prisma.foodOrder.findFirst({
    where: {
      id,
      customerId,
    },
  })

  if (!foodOrder) {
    return NextResponse.json({ error: "Food order not found" }, { status: 404 })
  }

  if (foodOrder.paymentStatus !== "PENDING" || foodOrder.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: "Food order is already completed or processed.",
      status: foodOrder.status,
      paymentStatus: foodOrder.paymentStatus,
    })
  }

  // Cancel order & payment
  await prisma.foodOrder.update({
    where: { id: foodOrder.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      settlementStatus: "CANCELLED",
    },
  })

  // Restore coupon
  await prisma.couponUsage.deleteMany({
    where: { foodOrderId: foodOrder.id },
  }).catch(() => null)

  return NextResponse.json({
    success: true,
    message: "Pending food order cancelled successfully.",
  })
}

