import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"
import { initiateFloatSubscriptionPayment } from "@/lib/subscriptions"
import { getMobileUserAuth } from "@/app/mobileapi/_helpers/ad-afrimoney"

export const dynamic = "force-dynamic"

/**
 * Universal Float Subscription Payment initiation for ALL 4 Seller Types (Web Session + Mobile Bearer JWT):
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
    const { planId, couponCode } = body

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
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
      return NextResponse.json(
        { error: "Seller account not found for current user" },
        { status: 404 }
      )
    }

    const result = await initiateFloatSubscriptionPayment({
      sellerType,
      sellerId,
      planId,
      couponCode,
      userId: authUserId,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message || "Failed to initiate Float payment" },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Float Subscription] Error in POST /api/seller/subscription/pay-float:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

