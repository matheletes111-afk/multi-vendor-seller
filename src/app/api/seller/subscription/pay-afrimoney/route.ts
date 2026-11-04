import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"
import { initiateAfriMoneySubscriptionPayment } from "@/lib/subscriptions"
import { getMobileUserAuth } from "@/app/mobileapi/_helpers/ad-afrimoney"

export const dynamic = "force-dynamic"

/**
 * Universal AfriMoney Subscription Payment initiation for ALL 4 Seller Types (Web Session + Mobile Bearer JWT):
 * - Product Seller
 * - Service Seller
 * - Hotel Seller
 * - Restaurant Seller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    let authUserId = session?.user?.id || null
    if (!authUserId) {
      const mobileAuth = await getMobileUserAuth(request)
      if (mobileAuth.ok && mobileAuth.user) {
        authUserId = mobileAuth.user.id
      }
    }
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { planId, phone, couponCode } = body

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const payerMsisdn = (phone || "").toString().trim()
    if (!payerMsisdn && !(couponCode && String(couponCode).trim())) {
      return NextResponse.json(
        { error: "Africell mobile number is required to receive Push USSD" },
        { status: 400 }
      )
    }

    // Resolve seller type & id from authUserId
    const [productSeller, hotelSeller, restaurantSeller] = await Promise.all([
      prisma.seller.findUnique({ where: { userId: authUserId } }),
      prisma.hotelSeller.findUnique({ where: { userId: authUserId } }),
      prisma.restaurantSeller.findUnique({ where: { userId: authUserId } }),
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
      userId: authUserId,
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

