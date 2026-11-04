import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server"
import { UserRole } from "@prisma/client"
import { verifySubscriptionPaymentStatus } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_HOTEL)
  if (!auth.success) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const purchaseId = searchParams.get("purchaseId")

    if (!purchaseId) {
      return NextResponse.json({ error: "purchaseId is required" }, { status: 400 })
    }

    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId },
      include: { hotelSeller: true },
    })

    if (!purchase) {
      return NextResponse.json({ error: "Subscription purchase record not found" }, { status: 404 })
    }

    if (purchase.hotelSellerId !== auth.seller.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await verifySubscriptionPaymentStatus(purchaseId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[GET /mobileapi/hotel-seller/subscription/verify-payment] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

