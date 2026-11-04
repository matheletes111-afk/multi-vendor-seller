import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"
import { initiateAfriMoneySubscriptionPayment } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

/**
 * Universal AfriMoney Subscription Payment initiation for ALL 4 Seller Types:
 * - Product Seller
 * - Service Seller
 * - Hotel Seller
 * - Restaurant Seller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    // Resolve seller type & id from session.user.id
    const [productSeller, hotelSeller, restaurantSeller] = await Promise.all([
      prisma.seller.findUnique({ where: { userId: session.user.id } }),
      prisma.hotelSeller.findUnique({ where: { userId: session.user.id } }),
      prisma.restaurantSeller.findUnique({ where: { userId: session.user.id } }),
    ])

    let sellerType: PlanType = PlanType.PRODUCT_SERVICE
    let sellerId = ""

    if (hotelSeller) {
      sellerType = PlanType.HOTEL
      sellerId = hotelSeller.id
    } else if (restaurantSeller) {
      sellerType = PlanType.RESTAURANT
      sellerId = restaurantSeller.id
    } else if (productSeller) {
      sellerType = PlanType.PRODUCT_SERVICE
      sellerId = productSeller.id
    } else {
      return NextResponse.json({ error: "Seller account not found" }, { status: 404 })
    }

    const result = await initiateAfriMoneySubscriptionPayment({
      sellerType,
      sellerId,
      planId,
      payerMsisdn,
      couponCode,
      userId: session.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message, ...result },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /api/seller/subscription/pay-afrimoney] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

