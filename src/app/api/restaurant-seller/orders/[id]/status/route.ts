import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { OrderStatus } from "@prisma/client"
import { creditRestaurantSellerForDelivery } from "@/lib/restaurant-ledger"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !Object.values(OrderStatus).includes(status as any)) {
      return NextResponse.json({ success: false, error: "Invalid order status value" }, { status: 400 })
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

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Web restaurant seller update order status error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
