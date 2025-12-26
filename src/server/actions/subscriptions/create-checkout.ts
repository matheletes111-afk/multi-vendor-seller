"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSubscriptionSession } from "@/lib/stripe"
import { isSeller } from "@/lib/rbac"
import { SubscriptionPlan } from "@prisma/client"
import { redirect } from "next/navigation"

export async function createSubscriptionCheckout(planName: SubscriptionPlan) {
  const session = await auth()
  
  if (!session?.user || !isSeller(session.user)) {
    redirect("/dashboard/seller/subscription?error=unauthorized")
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
    redirect("/dashboard/seller/subscription?error=seller_not_found")
  }

  const plan = await prisma.plan.findUnique({
    where: { name: planName },
  })

  if (!plan) {
    redirect("/dashboard/seller/subscription?error=plan_not_found")
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

    if (checkoutSession.url) {
      redirect(checkoutSession.url)
    } else {
      redirect("/dashboard/seller/subscription?error=checkout_failed")
    }
  } catch (error) {
    console.error("Stripe checkout error:", error)
    redirect("/dashboard/seller/subscription?error=checkout_failed")
  }
}

