import { prisma } from "@/lib/prisma"
import { SubscriptionPlan, PlanType } from "@prisma/client"

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
  
  // 1. Handle Initialization: If no period end is set, initialize with the plan's duration
  if (!subscription.currentPeriodEnd) {
    const durationDays = subscription.plan.duration || (subscription.plan.price === 0 ? 90 : 30)
    const periodEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
    return await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: subscription.createdAt,
        currentPeriodEnd: periodEnd,
        status: "ACTIVE",
      },
      include: { plan: true },
    })
  }

  // 2. Handle Expiration / Auto-renewal
  if (now > subscription.currentPeriodEnd) {
    if (subscription.plan.price === 0) {
      // FREE PLAN logic: Allowed based on plan's duration (e.g. 90 days / 3 months)
      const durationDays = subscription.plan.duration || 90
      const allowedWindowEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      
      if (now < allowedWindowEnd) {
        // Still within allowed window, align end to allowedWindowEnd
        return await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: subscription.currentPeriodStart || subscription.createdAt,
            currentPeriodEnd: allowedWindowEnd,
            status: "ACTIVE"
          },
          include: { plan: true }
        })
      } else {
        // Expired (over allowed duration total)
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
      // PAID PLAN logic (Test/Auto mode): Auto-renew based on plan's duration indefinitely for now
      return await applyRenewal(subscription.id, subscription.currentPeriodEnd, subscription.plan.duration || 30)
    }
  }

  return subscription
}

/** Helper to extend subscription period */
async function applyRenewal(id: string, fromDate: Date, durationDays: number) {
  const newEnd = new Date(fromDate)
  newEnd.setDate(newEnd.getDate() + durationDays)
  
  // If we are renewing from a date far in the past, ensure the new end is in the future
  const now = new Date()
  while (newEnd < now) {
    newEnd.setDate(newEnd.getDate() + durationDays)
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

  const planMaxProducts = subscription.plan.maxProducts
  
  if (planMaxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.product.count({
    where: { sellerId, isActive: true },
  })

  return {
    allowed: currentCount < planMaxProducts,
    current: currentCount,
    limit: planMaxProducts,
  }
}

export async function checkServiceLimit(sellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const planMaxProducts = subscription.plan.maxProducts
  
  if (planMaxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.service.count({
    where: { sellerId, isActive: true },
  })

  return {
    allowed: currentCount < planMaxProducts,
    current: currentCount,
    limit: planMaxProducts,
  }
}

export async function checkOrderLimit(sellerId: string, month?: Date): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const planMaxOrders = subscription.plan.maxOrders
  
  if (planMaxOrders === null) {
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
    allowed: currentCount < planMaxOrders,
    current: currentCount,
    limit: planMaxOrders,
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

export function createPlanSnapshot(plan: any): Record<string, any> | undefined {
  if (!plan) return undefined
  return {
    id: plan.id,
    name: plan.name,
    type: plan.type,
    displayName: plan.displayName,
    description: plan.description ?? null,
    price: plan.price,
    duration: plan.duration ?? 30,
    maxProducts: plan.maxProducts ?? null,
    maxOrders: plan.maxOrders ?? null,
    maxRooms: plan.maxRooms ?? null,
    features: plan.features ?? {},
  }
}

/** 
 * Automatically activates the free plan (0 RS) for a new seller. 
 * Used during registration/onboarding.
 */
export async function activateFreePlan(sellerId: string) {
  try {
    const freePlan = await prisma.plan.findFirst({ where: { price: 0, type: PlanType.PRODUCT_SERVICE } })
    if (!freePlan) return null
    const now = new Date()
    const durationDays = freePlan.duration || 90
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const snapshot = createPlanSnapshot(freePlan)

    return await prisma.subscription.upsert({
      where: { sellerId },
      create: { sellerId, planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
      update: { planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
    })
  } catch (error) {
    console.error(`[activateFreePlan] Error:`, error)
    return null
  }
}

export async function activateHotelFreePlan(hotelSellerId: string) {
  try {
    const freePlan = await prisma.plan.findFirst({ where: { price: 0, type: PlanType.HOTEL } })
    if (!freePlan) return null
    const now = new Date()
    const durationDays = freePlan.duration || 90
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const snapshot = createPlanSnapshot(freePlan)

    return await prisma.hotelSubscription.upsert({
      where: { hotelSellerId },
      create: { hotelSellerId, planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
      update: { planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
    })
  } catch (error) {
    console.error(`[activateHotelFreePlan] Error:`, error)
    return null
  }
}

export async function activateRestaurantFreePlan(restaurantSellerId: string) {
  try {
    const freePlan = await prisma.plan.findFirst({ where: { price: 0, type: PlanType.RESTAURANT } })
    if (!freePlan) return null
    const now = new Date()
    const durationDays = freePlan.duration || 90
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const snapshot = createPlanSnapshot(freePlan)

    return await prisma.restaurantSubscription.upsert({
      where: { restaurantSellerId },
      create: { restaurantSellerId, planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
      update: { planId: freePlan.id, paidPrice: 0, planSnapshot: snapshot, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
    })
  } catch (error) {
    console.error(`[activateRestaurantFreePlan] Error:`, error)
    return null
  }
}

export async function getValidHotelSubscription(hotelSellerId: string) {
  const subscription = await prisma.hotelSubscription.findUnique({
    where: { hotelSellerId },
    include: { plan: true },
  })

  if (!subscription) return null

  const now = new Date()
  
  if (!subscription.currentPeriodEnd) {
    const durationDays = subscription.plan.duration || (subscription.plan.price === 0 ? 90 : 30)
    const periodEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
    return await prisma.hotelSubscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: subscription.createdAt,
        currentPeriodEnd: periodEnd,
        status: "ACTIVE",
      },
      include: { plan: true },
    })
  }

  if (now > subscription.currentPeriodEnd) {
    if (subscription.plan.price === 0) {
      const durationDays = subscription.plan.duration || 90
      const allowedWindowEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      
      if (now < allowedWindowEnd) {
        return await prisma.hotelSubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: subscription.currentPeriodStart || subscription.createdAt,
            currentPeriodEnd: allowedWindowEnd,
            status: "ACTIVE"
          },
          include: { plan: true }
        })
      } else {
        if (subscription.status !== "CANCELED") {
          return await prisma.hotelSubscription.update({
            where: { id: subscription.id },
            data: { status: "CANCELED" },
            include: { plan: true }
          })
        }
        return subscription
      }
    } else {
      return await applyHotelRenewal(subscription.id, subscription.currentPeriodEnd, subscription.plan.duration || 30)
    }
  }

  return subscription
}

async function applyHotelRenewal(id: string, fromDate: Date, durationDays: number) {
  const newEnd = new Date(fromDate)
  newEnd.setDate(newEnd.getDate() + durationDays)
  const now = new Date()
  while (newEnd < now) {
    newEnd.setDate(newEnd.getDate() + durationDays)
  }

  return await prisma.hotelSubscription.update({
    where: { id },
    data: {
      currentPeriodStart: fromDate < now ? now : fromDate,
      currentPeriodEnd: newEnd,
      status: "ACTIVE"
    },
    include: { plan: true }
  })
}

export async function getValidRestaurantSubscription(restaurantSellerId: string) {
  const subscription = await prisma.restaurantSubscription.findUnique({
    where: { restaurantSellerId },
    include: { plan: true },
  })

  if (!subscription) return null

  const now = new Date()
  
  if (!subscription.currentPeriodEnd) {
    const durationDays = subscription.plan.duration || (subscription.plan.price === 0 ? 90 : 30)
    const periodEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
    return await prisma.restaurantSubscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: subscription.createdAt,
        currentPeriodEnd: periodEnd,
        status: "ACTIVE",
      },
      include: { plan: true },
    })
  }

  if (now > subscription.currentPeriodEnd) {
    if (subscription.plan.price === 0) {
      const durationDays = subscription.plan.duration || 90
      const allowedWindowEnd = new Date(subscription.createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      
      if (now < allowedWindowEnd) {
        return await prisma.restaurantSubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: subscription.currentPeriodStart || subscription.createdAt,
            currentPeriodEnd: allowedWindowEnd,
            status: "ACTIVE"
          },
          include: { plan: true }
        })
      } else {
        if (subscription.status !== "CANCELED") {
          return await prisma.restaurantSubscription.update({
            where: { id: subscription.id },
            data: { status: "CANCELED" },
            include: { plan: true }
          })
        }
        return subscription
      }
    } else {
      return await applyRestaurantRenewal(subscription.id, subscription.currentPeriodEnd, subscription.plan.duration || 30)
    }
  }

  return subscription
}

export async function checkHotelLimit(hotelSellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getValidHotelSubscription(hotelSellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const plan = subscription.plan
  
  if (plan.maxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.hotel.count({
    where: { hotelSellerId, isDeleted: false, isActive: true },
  })

  return {
    allowed: currentCount < plan.maxProducts,
    current: currentCount,
    limit: plan.maxProducts,
  }
}

export async function checkHotelRoomLimit(hotelSellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getValidHotelSubscription(hotelSellerId)
  
  if (!subscription || subscription.status !== "ACTIVE") {
    return { allowed: false, current: 0, limit: 0 }
  }

  const plan = subscription.plan
  
  if (plan.maxRooms === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.room.count({
    where: {
      hotel: { hotelSellerId },
      isDeleted: false,
      isActive: true,
    },
  })

  return {
    allowed: currentCount < plan.maxRooms,
    current: currentCount,
    limit: plan.maxRooms,
  }
}

async function applyRestaurantRenewal(id: string, fromDate: Date, durationDays: number) {
  const newEnd = new Date(fromDate)
  newEnd.setDate(newEnd.getDate() + durationDays)
  const now = new Date()
  while (newEnd < now) {
    newEnd.setDate(newEnd.getDate() + durationDays)
  }

  return await prisma.restaurantSubscription.update({
    where: { id },
    data: {
      currentPeriodStart: fromDate < now ? now : fromDate,
      currentPeriodEnd: newEnd,
      status: "ACTIVE"
    },
    include: { plan: true }
  })
}


