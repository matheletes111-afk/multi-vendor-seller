import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { UserRole, SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

/**
 * GET current subscription and available plans for service seller.
 */
export async function GET(request: NextRequest) {
  const auth = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 })
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: auth.userId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    const plans = await prisma.plan.findMany({
      where: { type: "PRODUCT_SERVICE" },
      orderBy: { price: "asc" },
    })

    return NextResponse.json({
      currentSubscription: seller.subscription || null,
      availablePlans: plans,
    })
  } catch (error) {
    console.error("[GET /mobileapi/service-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST update/switch subscription plan for service seller.
 * Uses direct update (test mode) for now.
 */
export async function POST(request: NextRequest) {
  const auth = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 })
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: auth.userId },
      include: { subscription: true },
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const planName = body.planName as SubscriptionPlan | undefined

    if (!planName) {
      return NextResponse.json({ error: "planName is required" }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({
      where: {
        name_type: {
          name: planName,
          type: "PRODUCT_SERVICE",
        },
      },
    })
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Direct update logic (Sync with web panel's "test: true" behavior)
    const now = new Date()
    const currentPeriodEnd = new Date(now)
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

    const updatedSubscription = await prisma.subscription.upsert({
      where: { sellerId: seller.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        sellerId: seller.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
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
    console.error("[POST /mobileapi/service-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
