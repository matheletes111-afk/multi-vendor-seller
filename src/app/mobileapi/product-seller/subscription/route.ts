import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { UserRole, SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

/**
 * GET current subscription and available plans for product seller.
 */
export async function GET(request: NextRequest) {
  const auth = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
    console.error("[GET /mobileapi/product-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST update/switch subscription plan for product seller.
 * Uses direct update (test mode) for now.
 */
export async function POST(request: NextRequest) {
  const auth = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
    const { planId, planName } = body as { planId?: string; planName?: SubscriptionPlan }

    if (!planId && !planName) {
      return NextResponse.json({ error: "planId or planName is required" }, { status: 400 })
    }

    let plan
    if (planId) {
      plan = await prisma.plan.findUnique({
        where: { id: planId },
      })
      if (plan && plan.type !== "PRODUCT_SERVICE") {
        plan = null
      }
    } else if (planName) {
      plan = await prisma.plan.findFirst({
        where: {
          name: planName,
          type: "PRODUCT_SERVICE",
        },
        orderBy: { price: "asc" },
      })
    }

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Direct update logic (Sync with web panel's "test: true" behavior)
    const now = new Date()
    const durationDays = plan.duration || 30
    const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

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
    console.error("[POST /mobileapi/product-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
