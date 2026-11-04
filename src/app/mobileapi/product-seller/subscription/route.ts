import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { UserRole, SubscriptionPlan, PlanType, SubscriptionStatus } from "@prisma/client"
import { activateOrQueuePurchase, createPlanSnapshot, getValidSubscription } from "@/lib/subscriptions"

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
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    const [subscription, plans, activeOrQueuedPurchases] = await Promise.all([
      getValidSubscription(seller.id),
      prisma.plan.findMany({
        where: { type: "PRODUCT_SERVICE" },
        orderBy: { price: "asc" },
      }),
      prisma.subscriptionPurchase.findMany({
        where: {
          sellerType: PlanType.PRODUCT_SERVICE,
          sellerId: seller.id,
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
    const { planId, planName, couponCode } = body as { planId?: string; planName?: SubscriptionPlan; couponCode?: string }

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
        userId: auth.userId,
      })
      if (!val.valid) {
        return NextResponse.json({ error: val.error || "Invalid coupon code" }, { status: 400 })
      }
      discountAmount = val.discountAmount || 0
      validatedCoupon = val.coupon
    }

    const finalAmount = Math.max(0, plan.price - discountAmount)

    const activation = await activateOrQueuePurchase({
      sellerType: PlanType.PRODUCT_SERVICE,
      sellerId: seller.id,
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
      message: activation.status === "QUEUED" ? "Subscription queued successfully" : "Subscription updated successfully",
      status: activation.status,
      subscription: activation.purchase,
      url: null,
    })
  } catch (error) {
    console.error("[POST /mobileapi/product-seller/subscription] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
