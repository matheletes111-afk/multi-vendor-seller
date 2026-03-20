import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { createSubscriptionSession } from "@/lib/stripe"
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

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
  const body = await request.json().catch(() => ({})) as { planName?: string; test?: boolean }
  const planName = body.planName as SubscriptionPlan | undefined
  if (!planName) return NextResponse.json({ error: "planName is required" }, { status: 400 })
  const plan = await prisma.plan.findUnique({ where: { name: planName } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const testMode = body.test === true
  const now = new Date()
  const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (testMode) {
    const existing = seller.subscription
    const stripeCustomerId = existing?.stripeCustomerId ?? null
    const stripeSubscriptionId = existing?.stripeSubscriptionId ?? null
    const stripePriceId = existing?.stripePriceId ?? null

    await prisma.subscription.upsert({
      where: { sellerId: seller.id },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
      },
      create: {
        sellerId: seller.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
      },
    })

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
      metadata: { sellerId: seller.id, planId: plan.id },
    })
    return NextResponse.json({ url: checkoutSession.url || null })
  } catch (error) {
    console.error("Checkout session error:", error)
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
  }
}
