import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../../_helpers/seller-auth"
import { manualAssignRiderToOrder, triggerOrderAutoDispatch } from "@/lib/delivery-dispatch"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: authStatus.userId },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
  }

  try {
    const { id: orderId } = await params
    const body = await request.json().catch(() => ({}))
    const { riderId, action, notes } = body

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: { some: { sellerId: seller.id, productId: { not: null } } },
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found for this seller" }, { status: 404 })
    }

    // Auto-dispatch option
    if (action === "auto_dispatch") {
      const result = await triggerOrderAutoDispatch(order.id, seller.id)
      return NextResponse.json({
        success: result.success,
        message: result.message || "Auto-dispatch initiated",
        data: result,
      })
    }

    if (!riderId) {
      return NextResponse.json(
        { success: false, error: "riderId is required for manual assignment" },
        { status: 400 }
      )
    }

    const result = await manualAssignRiderToOrder(order.id, riderId, "MANUAL_SELLER", notes, seller.id)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Rider assigned successfully",
      data: result.assignment,
    })
  } catch (error: any) {
    console.error("[Mobile API] Seller assign rider error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to assign rider" },
      { status: 500 }
    )
  }
}
