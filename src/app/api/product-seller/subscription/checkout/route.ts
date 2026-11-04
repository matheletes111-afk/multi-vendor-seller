import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { createSubscriptionSession } from "@/lib/stripe"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"
import { createPlanSnapshot, activateOrQueuePurchase } from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"

/** POST create Stripe checkout session for subscription. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { subscription: { include: { plan: true } } },
  })
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

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
        type: "PRODUCT_SERVICE",
      },
      orderBy: { price: "asc" }
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
  const testMode = body.test === true
  const now = new Date()
  const durationDays = plan.duration || 30
  const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
  const snapshot = createPlanSnapshot(plan)

  if (testMode || finalPaidPrice === 0) {
    const purchaseResult = await activateOrQueuePurchase({
      sellerType: PlanType.PRODUCT_SERVICE,
      sellerId: seller.id,
      planId: plan.id,
      price: plan.price,
      paidPrice: finalPaidPrice,
      discountAmount,
      couponCode: appliedCoupon?.code || null,
      paymentMethod: appliedCoupon ? "COUPON_100_PERCENT" : (finalPaidPrice === 0 ? "FREE" : "TEST_DIRECT"),
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
  }

  const baseUrl = process.env.NEXTAUTH_URL || ""
  const subscriptionBase = `${baseUrl}/product-seller/subscription`

  try {
    const checkoutSession = await createSubscriptionSession({
      priceId: `price_${plan.name.toLowerCase()}`,
      customerId: seller.subscription?.stripeCustomerId || undefined,
      successUrl: `${subscriptionBase}?success=true`,
      cancelUrl: `${subscriptionBase}?canceled=true`,
      metadata: { sellerId: seller.id, planId: plan.id, couponId: appliedCoupon?.id || "" },
    })
    return NextResponse.json({ url: checkoutSession.url || null })
  } catch (error) {
    console.error("Checkout session error:", error)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
