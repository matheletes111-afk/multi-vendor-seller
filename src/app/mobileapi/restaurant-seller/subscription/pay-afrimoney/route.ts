import { NextRequest, NextResponse } from "next/server"
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server"
import { UserRole, PlanType } from "@prisma/client"
import { initiateAfriMoneySubscriptionPayment } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { planId, phone, couponCode } = body

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const payerMsisdn = (phone || "").toString().trim()
    if (!payerMsisdn) {
      return NextResponse.json(
        { error: "Africell mobile number is required to receive Push USSD" },
        { status: 400 }
      )
    }

    const result = await initiateAfriMoneySubscriptionPayment({
      sellerType: PlanType.RESTAURANT,
      sellerId: auth.seller.id,
      planId,
      payerMsisdn,
      couponCode,
      userId: auth.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message, ...result },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /mobileapi/restaurant-seller/subscription/pay-afrimoney] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

