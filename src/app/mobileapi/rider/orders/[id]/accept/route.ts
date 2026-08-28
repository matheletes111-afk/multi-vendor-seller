import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import { handleRiderAcceptAssignment } from "@/lib/delivery-dispatch"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: authResult.rider.id,
        OR: [{ id }, { orderId: id }],
        status: "OFFERED",
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "No pending assignment offer found for this order" },
        { status: 404 }
      )
    }

    const result = await handleRiderAcceptAssignment(assignment.id, authResult.rider.id)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Delivery assignment accepted successfully",
      data: {
        assignment: result.assignment,
        deliveryOtp: result.deliveryOtp,
      },
    })
  } catch (error: any) {
    console.error("[Mobile API] Accept assignment error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to accept assignment" },
      { status: 500 }
    )
  }
}
