import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { manualAssignRiderToOrder, triggerOrderAutoDispatch, stopOrderAutoDispatch, cancelAcceptedRiderAssignment } from "@/lib/delivery-dispatch"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { riderId, action, notes, sellerId, reason, cancellationReason } = body

    const userRole = session.user.role

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        seller: true,
        items: { select: { sellerId: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Role check: Only ADMIN or the specific SELLER can assign
    let targetSellerId = sellerId || undefined
    if (userRole !== "ADMIN") {
      const seller = await prisma.seller.findUnique({
        where: { userId: session.user.id },
      })
      const isSellerOfOrder =
        seller &&
        (seller.id === order.sellerId || order.items.some((i) => i.sellerId === seller.id))

      if (!seller || !isSellerOfOrder) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to assign riders for this order" },
          { status: 403 }
        )
      }
      targetSellerId = seller.id
    }

    // If action is "auto_dispatch", trigger the waterfall engine
    if (action === "auto_dispatch") {
      const result = await triggerOrderAutoDispatch(order.id, targetSellerId, {
        forceRedispatch: true,
        allowReofferRejected: true,
      })
      return NextResponse.json(
        {
          success: result.success,
          message:
            result.message ||
            (result.success
               ? "Auto-dispatch initiated! Nearest free rider contacted."
               : "Auto-dispatch failed to find an available rider."),
          data: result,
        },
        { status: result.success ? 200 : 400 }
      )
    }

    // If action is "stop_dispatch", cancel pending offers and halt notifications
    if (action === "stop_dispatch") {
      const cancelledBy = userRole === "ADMIN" ? "ADMIN" : "SELLER"
      const result = await stopOrderAutoDispatch(order.id, targetSellerId, cancelledBy)
      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          data: result,
        },
        { status: result.success ? 200 : 400 }
      )
    }

    // If action is "cancel_assignment" / "cancel_rider", revoke active rider (ACCEPTED or AT_PICKUP)
    if (action === "cancel_assignment" || action === "cancel_rider") {
      const cancelledBy = userRole === "ADMIN" ? "ADMIN" : "SELLER"
      const customReason = reason || cancellationReason || "Rider did not show up"
      const result = await cancelAcceptedRiderAssignment(order.id, targetSellerId, cancelledBy, customReason)
      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          data: result,
        },
        { status: result.success ? 200 : 400 }
      )
    }

    if (!riderId) {
      return NextResponse.json(
        { error: "riderId is required for manual assignment" },
        { status: 400 }
      )
    }

    const mode = userRole === "ADMIN" ? "MANUAL_ADMIN" : "MANUAL_SELLER"
    const result = await manualAssignRiderToOrder(order.id, riderId, mode, notes, targetSellerId)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Rider assigned successfully",
      assignment: result.assignment,
    })
  } catch (error: any) {
    console.error("[API] Assign rider error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to assign rider" },
      { status: 500 }
    )
  }
}
