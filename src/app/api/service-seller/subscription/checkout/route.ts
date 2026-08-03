import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { createSubscriptionSession } from "@/lib/stripe"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { subscription: { include: { plan: true } } },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
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

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  let appliedCoupon: any = null
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
  }

  const testMode = body.test === true
  const now = new Date()
  const durationDays = plan.duration || 30
  const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  if (testMode) {
    const sub = await prisma.subscription.upsert({
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
    })

    if (appliedCoupon) {
      await recordSellerCouponUsage({
        couponId: appliedCoupon.id,
        userId: session.user.id,
        subscriptionId: sub.id
      })
    }

    return NextResponse.json({ url: null })
  }

  const baseUrl = process.env.NEXTAUTH_URL || ""
  const subscriptionBase = `${baseUrl}/service-seller/subscription`
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
