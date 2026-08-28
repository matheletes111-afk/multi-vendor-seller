import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleRiderAcceptAssignment } from "@/lib/delivery-dispatch"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
    }

    // Find assignment by id or orderId
    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: rider.id,
        OR: [{ id }, { orderId: id }],
        status: "OFFERED",
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "No pending assignment offer found for this order" },
        { status: 404 }
      )
    }

    const result = await handleRiderAcceptAssignment(assignment.id, rider.id)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Delivery assignment accepted successfully",
      assignment: result.assignment,
      deliveryOtp: result.deliveryOtp,
    })
  } catch (error: any) {
    console.error("[API] Accept assignment error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to accept assignment" },
      { status: 500 }
    )
  }
}
