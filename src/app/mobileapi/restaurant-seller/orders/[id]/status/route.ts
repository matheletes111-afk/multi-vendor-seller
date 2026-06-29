import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole, OrderStatus } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../../_helpers/hotel-restaurant-seller-auth"
import { creditRestaurantSellerForDelivery } from "@/lib/restaurant-ledger"

export const dynamic = "force-dynamic"

// PUT: Update restaurant seller's order status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const body = await request.json()
    const { status } = body

    if (!status || !Object.values(OrderStatus).includes(status as any)) {
      return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 })
    }

    const order = await prisma.foodOrder.findFirst({
      where: { id, restaurantSellerId: seller.id }
    })

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found or access denied" }, { status: 404 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.foodOrder.update({
        where: { id },
        data: { status: status as OrderStatus }
      })
      if (status === "DELIVERED") {
        await creditRestaurantSellerForDelivery(tx, id)
      }
      return up
    })

    return NextResponse.json({
      success: true,
      message: "Order status updated successfully",
      data: updated
    })
  } catch (error: any) {
    console.error("Mobile update restaurant order status error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
