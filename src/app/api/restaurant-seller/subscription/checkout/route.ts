import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"
import { createPlanSnapshot, activateOrQueuePurchase } from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isRestaurantSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id },
      include: { subscription: true },
    })
    if (!seller) return NextResponse.json({ error: "Restaurant Seller not found" }, { status: 404 })

    const body = await request.json().catch(() => ({})) as { planId?: string; planName?: string; test?: boolean; couponCode?: string }
    const { planId, planName, couponCode } = body
    if (!planId && !planName) {
      return NextResponse.json({ error: "planId or planName is required" }, { status: 400 })
    }

    let plan
    if (planId) {
      plan = await prisma.plan.findUnique({
        where: { id: planId },
      })
    } else if (planName) {
      plan = await prisma.plan.findFirst({
        where: {
          name: planName as SubscriptionPlan,
          type: "RESTAURANT",
        },
        orderBy: { price: "asc" }
      })
    }

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    if (plan.price <= 0) {
      return NextResponse.json(
        { error: "Free introductory plan is granted once upon admin approval and cannot be extended or repurchased." },
        { status: 400 }
      )
    }

    let appliedCoupon: any = null
    let discountAmount = 0
    if (couponCode && couponCode.trim()) {
      const couponValidation = await validateSellerCoupon({
        code: couponCode.trim(),
        amount: plan.price,
        userId: session.user.id
      })
      if (!couponValidation.valid) {
        return NextResponse.json({ error: couponValidation.error }, { status: 400 })
      }
      appliedCoupon = couponValidation.coupon
      discountAmount = couponValidation.discountAmount || 0
    }

    const finalPaidPrice = Math.max(0, plan.price - discountAmount)
    const now = new Date()

    const purchaseResult = await activateOrQueuePurchase({
      sellerType: PlanType.RESTAURANT,
      restaurantSellerId: seller.id,
      planId: plan.id,
      price: plan.price,
      paidPrice: finalPaidPrice,
      discountAmount,
      couponCode: appliedCoupon?.code || null,
      durationDays: plan.duration || 30,
      paymentMethod: appliedCoupon && finalPaidPrice === 0 ? "COUPON_100_PERCENT" : "TEST_DIRECT",
      paidAt: now,
    })

    if (appliedCoupon) {
      await recordSellerCouponUsage({
        couponId: appliedCoupon.id,
        userId: session.user.id,
        subscriptionId: purchaseResult.purchase.id,
      })
    }

    return NextResponse.json({ url: null, status: purchaseResult.status })
  } catch (error) {
    console.error("Restaurant subscription checkout error:", error)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
