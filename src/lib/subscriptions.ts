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
  return await prisma.subscription.findUnique({
    where: { sellerId },
    include: { plan: true },
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

