"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSubscriptionSession } from "@/lib/stripe"
import { isSeller } from "@/lib/rbac"
import { SubscriptionPlan } from "@prisma/client"

export async function createSubscriptionCheckout(planName: SubscriptionPlan) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    return { error: "Unauthorized" }
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  })

  if (!seller) {
    return { error: "Seller not found" }
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName },
  })

  if (!plan) {
    return { error: "Plan not found" }
  }

  // Create or get Stripe customer
  let stripeCustomerId = seller.subscription?.stripeCustomerId

  if (!stripeCustomerId) {
    // In a real app, create Stripe customer here
    // For now, we'll use the seller ID as a placeholder
    stripeCustomerId = `cus_${seller.id}`
  }

  try {
    const checkoutSession = await createSubscriptionSession({
      priceId: `price_${plan.name.toLowerCase()}`, // This should be your actual Stripe price ID
      customerId: stripeCustomerId,
      successUrl: `${process.env.NEXTAUTH_URL}/dashboard/seller/subscription?success=true`,
      cancelUrl: `${process.env.NEXTAUTH_URL}/dashboard/seller/subscription?canceled=true`,
      metadata: {
        sellerId: seller.id,
        planId: plan.id,
      },
    })

    return { url: checkoutSession.url }
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return { error: "Failed to create checkout session" }
  }
}

