import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileHotelRestaurantAuth } from "@/lib/mobile-hotel-restaurant-auth-server"
import { UserRole, SubscriptionPlan, PlanType } from "@prisma/client"
import { activateOrQueuePurchase, getValidRestaurantSubscription } from "@/lib/subscriptions"

/**
 * GET current subscription and available plans for restaurant seller.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT)
  if (!auth.success) return auth.errorResponse

  try {
    const [subscription, plans, activeOrQueuedPurchases] = await Promise.all([
      getValidRestaurantSubscription(auth.seller.id),
      prisma.plan.findMany({
        where: { type: "RESTAURANT" },
        orderBy: { price: "asc" },
      }),
      prisma.subscriptionPurchase.findMany({
        where: {
          sellerType: PlanType.RESTAURANT,
          restaurantSellerId: auth.seller.id,
          status: { in: ["ACTIVE", "QUEUED"] },
        },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const activePurchase = activeOrQueuedPurchases.find((p) => p.status === "ACTIVE")
    const queuedPacks = activeOrQueuedPurchases
      .filter((p) => p.status === "QUEUED")
      .map((q) => ({
        id: q.id,
        planId: q.planId,
        planName: q.plan?.displayName || q.plan?.name,
        status: q.status,
        periodStart: q.periodStart,
        periodEnd: q.periodEnd,
        durationDays: q.durationDays,
        price: q.price,
        paidPrice: q.paidPrice,
        couponCode: q.couponCode || null,
        discountAmount: q.discountAmount || 0,
        paymentMethod: q.paymentMethod,
      }))

    const enrichedPlans = plans.map((p) => ({
      ...p,
      isFreeTrial: p.price <= 0,
      isPurchasable: p.price > 0,
      canExtend: p.price > 0,
    }))

    const currentSubscription = subscription
      ? {
          ...subscription,
          canExtend: (subscription.plan?.price ?? 0) > 0,
          appliedCoupon: activePurchase?.couponCode
            ? {
                code: activePurchase.couponCode,
                discountAmount: activePurchase.discountAmount || 0,
                finalPaidAmount: activePurchase.paidPrice,
              }
            : null,
        }
      : null

    return NextResponse.json({
      currentSubscription,
      queuedPacks,
      availablePlans: enrichedPlans,
    })
  } catch (error) {
    console.error("[GET /mobileapi/restaurant-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST update/switch subscription plan for restaurant seller.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileHotelRestaurantAuth(request, UserRole.SELLER_RESTAURANT)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { planId, planName, couponCode } = body as { planId?: string; planName?: SubscriptionPlan; couponCode?: string }

    if (!planId && !planName) {
      return NextResponse.json({ error: "planId or planName is required" }, { status: 400 })
    }

    let plan
    if (planId) {
      plan = await prisma.plan.findUnique({
        where: { id: planId },
      })
      if (plan && plan.type !== "RESTAURANT") {
        plan = null
      }
    } else if (planName) {
      plan = await prisma.plan.findFirst({
        where: {
          name: planName,
          type: "RESTAURANT",
        },
        orderBy: { price: "asc" },
      })
    }

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (plan.price <= 0) {
      return NextResponse.json(
        { error: "Free introductory plan is granted once upon admin approval and cannot be extended or repurchased." },
        { status: 400 }
      )
    }

    // Validate Coupon if provided
    let discountAmount = 0
    let validatedCoupon: any = null
    if (couponCode && String(couponCode).trim()) {
      const { validateSellerCoupon } = await import("@/lib/coupons")
      const val = await validateSellerCoupon({
        code: String(couponCode).trim(),
        amount: plan.price,
        userId: auth.user.id,
      })
      if (!val.valid) {
        return NextResponse.json({ error: val.error || "Invalid coupon code" }, { status: 400 })
      }
      discountAmount = val.discountAmount || 0
      validatedCoupon = val.coupon
    }

    const finalAmount = Math.max(0, plan.price - discountAmount)

    // Universal activateOrQueuePurchase handler
    const activation = await activateOrQueuePurchase({
      sellerType: PlanType.RESTAURANT,
      restaurantSellerId: auth.seller.id,
      planId: plan.id,
      price: plan.price,
      paidPrice: finalAmount,
      discountAmount,
      couponCode: validatedCoupon?.code || null,
      durationDays: plan.duration || 30,
      paymentMethod: validatedCoupon && finalAmount === 0 ? "COUPON_100_PERCENT" : "MOBILE_DIRECT",
      paidAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      message: activation.status === "QUEUED" ? "Subscription queued successfully" : "Subscription activated successfully",
      status: activation.status,
      subscription: activation.purchase,
      url: null,
    })
  } catch (error) {
    console.error("[POST /mobileapi/restaurant-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
