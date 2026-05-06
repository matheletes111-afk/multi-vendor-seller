import { prisma } from "@/lib/prisma"
import { SubscriptionPlan } from "@prisma/client"

export interface SubscriptionLimits {
  maxProducts: number | null
  maxOrders: number | null
  canFeature: boolean
  canReceiveReviews: boolean
  hasAdvancedAnalytics: boolean
  hasPrioritySupport: boolean
  hasCustomBranding: boolean
}

export const PLAN_LIMITS: Record<SubscriptionPlan, SubscriptionLimits> = {
  FREE: {
    maxProducts: 5,
    maxOrders: 10,
    canFeature: false,
    canReceiveReviews: false,
    hasAdvancedAnalytics: false,
    hasPrioritySupport: false,
    hasCustomBranding: false,
  },
  STANDARD: {
    maxProducts: 50,
    maxOrders: null, // unlimited
    canFeature: false,
    canReceiveReviews: true,
    hasAdvancedAnalytics: false,
    hasPrioritySupport: false,
    hasCustomBranding: false,
  },
  PREMIUM: {
    maxProducts: null, // unlimited
    maxOrders: null, // unlimited
    canFeature: true,
    canReceiveReviews: true,
    hasAdvancedAnalytics: true,
    hasPrioritySupport: true,
    hasCustomBranding: true,
  },
}

export async function getSellerSubscription(sellerId: string) {
  return await getValidSubscription(sellerId)
}

/**
 * Core logic to retrieve a subscription, handling auto-renewals and 3-month free plan limits.
 * Synchronizes behavior across web and mobile.
 */
export async function getValidSubscription(sellerId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { sellerId },
    include: { plan: true },
  })

  if (!subscription) return null

  const now = new Date()
  
  // 1. Handle Initialization: If no period end is set, initialize for 1 month
  if (!subscription.currentPeriodEnd) {
    return await applyRenewal(subscription.id, subscription.createdAt, 1)
  }

  // 2. Handle Expiration / Auto-renewal
  if (now > subscription.currentPeriodEnd) {
    if (subscription.plan.price === 0) {
      // FREE PLAN logic: Max 3 months from creation
      const threeMonthsAfterStart = new Date(subscription.createdAt)
      threeMonthsAfterStart.setMonth(threeMonthsAfterStart.getMonth() + 3)
      
      if (now < threeMonthsAfterStart) {
        // Still within 3-month window, auto-renew for 1 month
        return await applyRenewal(subscription.id, subscription.currentPeriodEnd, 1)
      } else {
        // Expired (over 3 months total)
        if (subscription.status !== "CANCELED") {
          return await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "CANCELED" },
            include: { plan: true }
          })
        }
        return subscription
      }
    } else {
      // PAID PLAN logic (Test/Auto mode): Auto-renew monthly indefinitely for now
      // This will be replaced by payment-success checks later.
      return await applyRenewal(subscription.id, subscription.currentPeriodEnd, 1)
    }
  }

  return subscription
}

/** Helper to extend subscription period */
async function applyRenewal(id: string, fromDate: Date, months: number) {
  const newEnd = new Date(fromDate)
  newEnd.setMonth(newEnd.getMonth() + months)
  
  // If we are renewing from a date far in the past, ensure the new end is in the future
  const now = new Date()
  while (newEnd < now) {
    newEnd.setMonth(newEnd.getMonth() + 1)
  }

  return await prisma.subscription.update({
    where: { id },
    data: {
      currentPeriodStart: fromDate < now ? now : fromDate,
      currentPeriodEnd: newEnd,
      status: "ACTIVE"
    },
    include: { plan: true }
  })
}

export async function checkProductLimit(sellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const plan = subscription.plan.name
  const limits = PLAN_LIMITS[plan]
  
  if (limits.maxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.product.count({
    where: { sellerId, isActive: true },
  })

  return {
    allowed: currentCount < limits.maxProducts,
    current: currentCount,
    limit: limits.maxProducts,
  }
}

export async function checkServiceLimit(sellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const plan = subscription.plan.name
  const limits = PLAN_LIMITS[plan]
  
  if (limits.maxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.service.count({
    where: { sellerId, isActive: true },
  })

  return {
    allowed: currentCount < limits.maxProducts,
    current: currentCount,
    limit: limits.maxProducts,
  }
}

export async function checkOrderLimit(sellerId: string, month?: Date): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const plan = subscription.plan.name
  const limits = PLAN_LIMITS[plan]
  
  if (limits.maxOrders === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const targetMonth = month || new Date()
  const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1)
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59)

  const currentCount = await prisma.order.count({
    where: {
      sellerId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })

  return {
    allowed: currentCount < limits.maxOrders,
    current: currentCount,
    limit: limits.maxOrders,
  }
}

export function canFeature(sellerId: string, subscription: { plan: { name: SubscriptionPlan } } | null): boolean {
  if (!subscription) return false
  return PLAN_LIMITS[subscription.plan.name].canFeature
}

export function canReceiveReviews(sellerId: string, subscription: { plan: { name: SubscriptionPlan } } | null): boolean {
  if (!subscription) return false
  return PLAN_LIMITS[subscription.plan.name].canReceiveReviews
}

/** 
 * Automatically activates the free plan (0 RS) for a new seller. 
 * Used during registration/onboarding.
 */
export async function activateFreePlan(sellerId: string) {
  try {
    // 1. Find the plan with price 0
    const freePlan = await prisma.plan.findFirst({
      where: { price: 0 },
    })

    if (!freePlan) {
      console.error(`[activateFreePlan] No plan with 0 RS found in database. Cannot auto-activate for seller ${sellerId}`)
      return null
    }

    // 2. Create the subscription with 1-month initial period
    const now = new Date()
    const oneMonthLater = new Date(now)
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

    const subscription = await prisma.subscription.upsert({
      where: { sellerId },
      create: {
        sellerId,
        planId: freePlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthLater,
      },
      update: {
        planId: freePlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthLater,
      },
    })

    return subscription
  } catch (error) {
    console.error(`[activateFreePlan] Error activating free plan for seller ${sellerId}:`, error)
    return null
  }
}

