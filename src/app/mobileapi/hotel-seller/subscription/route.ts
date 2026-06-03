import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server"
import { UserRole, SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

/**
 * GET current subscription and available plans for hotel seller.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_HOTEL)
  if (!auth.success) return auth.errorResponse

  try {
    const subscription = await prisma.hotelSubscription.findUnique({
      where: { hotelSellerId: auth.seller.id },
      include: {
        plan: true,
      },
    })

    const plans = await prisma.plan.findMany({
      where: { type: "HOTEL" },
      orderBy: { price: "asc" },
    })

    return NextResponse.json({
      currentSubscription: subscription || null,
      availablePlans: plans,
    })
  } catch (error) {
    console.error("[GET /mobileapi/hotel-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST update/switch subscription plan for hotel seller.
 * Uses direct update (test mode) for now.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_HOTEL)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { planId, planName } = body as { planId?: string; planName?: SubscriptionPlan }

    if (!planId && !planName) {
      return NextResponse.json({ error: "planId or planName is required" }, { status: 400 })
    }

    let plan
    if (planId) {
      plan = await prisma.plan.findUnique({
        where: { id: planId },
      })
      if (plan && plan.type !== "HOTEL") {
        plan = null
      }
    } else if (planName) {
      plan = await prisma.plan.findFirst({
        where: {
          name: planName,
          type: "HOTEL",
        },
        orderBy: { price: "asc" },
      })
    }

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Direct update logic
    const now = new Date()
    const durationDays = plan.duration || 30
    const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const updatedSubscription = await prisma.hotelSubscription.upsert({
      where: { hotelSellerId: auth.seller.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
      create: {
        hotelSellerId: auth.seller.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
      include: { plan: true }
    })

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully",
      subscription: updatedSubscription,
      url: null // null indicates direct update (no Stripe redirect needed)
    })
  } catch (error) {
    console.error("[POST /mobileapi/hotel-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
