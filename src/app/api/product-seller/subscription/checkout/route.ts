import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { createSubscriptionSession } from "@/lib/stripe"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

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

  const body = await request.json().catch(() => ({})) as { planId?: string; planName?: string; test?: boolean }
  const { planId, planName } = body
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

  const testMode = body.test === true
  const now = new Date()
  const durationDays = plan.duration || 30
  const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  if (testMode) {
    await prisma.subscription.upsert({
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

    return NextResponse.json({ url: null })
  }

  const baseUrl = process.env.NEXTAUTH_URL || ""
  const subscriptionBase = `${baseUrl}/product-seller/subscription`

  try {
    const checkoutSession = await createSubscriptionSession({
      priceId: `price_${plan.name.toLowerCase()}`,
      customerId: seller.subscription?.stripeCustomerId || undefined,
      successUrl: `${subscriptionBase}?success=true`,
      cancelUrl: `${subscriptionBase}?canceled=true`,
      metadata: { sellerId: seller.id, planId: plan.id },
    })
    return NextResponse.json({ url: checkoutSession.url || null })
  } catch (error) {
    console.error("Checkout session error:", error)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
