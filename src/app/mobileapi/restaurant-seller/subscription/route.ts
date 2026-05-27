import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server"
import { UserRole, SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

/**
 * GET current subscription and available plans for restaurant seller.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT)
  if (!auth.success) return auth.errorResponse

  try {
    const subscription = await prisma.restaurantSubscription.findUnique({
      where: { restaurantSellerId: auth.seller.id },
      include: {
        plan: true,
      },
    })

    const plans = await prisma.plan.findMany({
      where: { type: "RESTAURANT" },
      orderBy: { price: "asc" },
    })

    return NextResponse.json({
      currentSubscription: subscription || null,
      availablePlans: plans,
    })
  } catch (error) {
    console.error("[GET /mobileapi/restaurant-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST update/switch subscription plan for restaurant seller.
 * Uses direct update (test mode) for now.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const planName = body.planName as SubscriptionPlan | undefined

    if (!planName) {
      return NextResponse.json({ error: "planName is required" }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({
      where: {
        name_type: {
          name: planName,
          type: "RESTAURANT",
        },
      },
    })
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Direct update logic
    const now = new Date()
    const currentPeriodEnd = new Date(now)
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

    const updatedSubscription = await prisma.restaurantSubscription.upsert({
      where: { restaurantSellerId: auth.seller.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
      create: {
        restaurantSellerId: auth.seller.id,
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
    console.error("[POST /mobileapi/restaurant-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
