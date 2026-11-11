import { prisma } from "@/lib/prisma"
import { initiateAfriMoneyPushUssd } from "@/lib/afrimoney"
import { createFlotPaymentLink, verifyFlotPaymentAttempt } from "@/lib/flot"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"
import { SubscriptionPlan, PlanType, SubscriptionLedgerStatus, SubscriptionStatus } from "@prisma/client"

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
  let subscription = await prisma.subscription.findUnique({
    where: { sellerId },
    include: { plan: true },
  })

  if (!subscription) {
    // Safety net (Section 10.2 #6): If an approved seller has no subscription yet, auto-assign their 1-time 90-day free trial
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { isApproved: true },
    })
    if (seller?.isApproved) {
      await assignFreePlanOnApproval(PlanType.PRODUCT_SERVICE, sellerId)
      subscription = await prisma.subscription.findUnique({
        where: { sellerId },
        include: { plan: true },
      })
    }
    if (!subscription) return null
  }

  // Apple IAP Guard: Apple Webhooks and StoreKit 2 manage status lifecycle.
  // Never auto-renew or overwrite Apple IAP subscription status here.
  if (subscription.provider === "apple_iap") {
    return subscription
  }

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

  // 2. Handle Expiration / Promotion
  if (now > subscription.currentPeriodEnd) {
    // Check if there is a queued pack to promote
    const promoted = await promoteQueuedPackIfExists(PlanType.PRODUCT_SERVICE, sellerId)
    if (promoted) {
      return promoted
    }

    // No queued pack -> mark EXPIRED
    if (subscription.status !== "EXPIRED") {
      await prisma.subscriptionPurchase.updateMany({
        where: {
          sellerType: PlanType.PRODUCT_SERVICE,
          sellerId,
          status: "ACTIVE",
        },
        data: { status: "EXPIRED", expiredAt: now },
      })

      return await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
        include: { plan: true },
      })
    }
    return subscription
  }

  return subscription
}

/** Check whether subscription grants active operational privileges (Active or in Billing Grace Period) */
export function isSubscriptionPrivileged(subscription: { status: string; currentPeriodEnd?: Date | null } | null | undefined): boolean {
  if (!subscription) return false
  if (subscription.status !== "ACTIVE" && subscription.status !== "IN_GRACE_PERIOD") return false
  if (subscription.currentPeriodEnd && new Date() > new Date(subscription.currentPeriodEnd)) {
    return false
  }
  return true
}

export async function checkProductLimit(sellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getSellerSubscription(sellerId)
  
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
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
  
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
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
  
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
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
 * Automatically activates the free plan (0 RS) for an approved seller.
 * Per Section 10.2: Free trial clock starts strictly upon Admin Approval via assignFreePlanOnApproval.
 */
export async function activateFreePlan(sellerId: string) {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { isApproved: true },
    })
    if (!seller?.isApproved) {
      return null
    }
    await assignFreePlanOnApproval(PlanType.PRODUCT_SERVICE, sellerId)
    return await prisma.subscription.findUnique({ where: { sellerId }, include: { plan: true } })
  } catch (error) {
    console.error(`[activateFreePlan] Error:`, error)
    return null
  }
}

export async function activateHotelFreePlan(hotelSellerId: string) {
  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { id: hotelSellerId },
      select: { isApproved: true },
    })
    if (!seller?.isApproved) {
      return null
    }
    await assignFreePlanOnApproval(PlanType.HOTEL, hotelSellerId)
    return await prisma.hotelSubscription.findUnique({ where: { hotelSellerId }, include: { plan: true } })
  } catch (error) {
    console.error(`[activateHotelFreePlan] Error:`, error)
    return null
  }
}

export async function activateRestaurantFreePlan(restaurantSellerId: string) {
  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { id: restaurantSellerId },
      select: { isApproved: true },
    })
    if (!seller?.isApproved) {
      return null
    }
    await assignFreePlanOnApproval(PlanType.RESTAURANT, restaurantSellerId)
    return await prisma.restaurantSubscription.findUnique({ where: { restaurantSellerId }, include: { plan: true } })
  } catch (error) {
    console.error(`[activateRestaurantFreePlan] Error:`, error)
    return null
  }
}

export async function getValidHotelSubscription(hotelSellerId: string) {
  let subscription = await prisma.hotelSubscription.findUnique({
    where: { hotelSellerId },
    include: { plan: true },
  })

  if (!subscription) {
    const seller = await prisma.hotelSeller.findUnique({
      where: { id: hotelSellerId },
      select: { isApproved: true },
    })
    if (seller?.isApproved) {
      await assignFreePlanOnApproval(PlanType.HOTEL, hotelSellerId)
      subscription = await prisma.hotelSubscription.findUnique({
        where: { hotelSellerId },
        include: { plan: true },
      })
    }
    if (!subscription) return null
  }

  // Apple IAP Guard
  if (subscription.provider === "apple_iap") {
    return subscription
  }

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
    const promoted = await promoteQueuedPackIfExists(PlanType.HOTEL, hotelSellerId)
    if (promoted) {
      return promoted
    }

    if (subscription.status !== "EXPIRED") {
      await prisma.subscriptionPurchase.updateMany({
        where: {
          sellerType: PlanType.HOTEL,
          hotelSellerId,
          status: "ACTIVE",
        },
        data: { status: "EXPIRED", expiredAt: now },
      })

      return await prisma.hotelSubscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
        include: { plan: true },
      })
    }
    return subscription
  }

  return subscription
}

export async function getValidRestaurantSubscription(restaurantSellerId: string) {
  let subscription = await prisma.restaurantSubscription.findUnique({
    where: { restaurantSellerId },
    include: { plan: true },
  })

  if (!subscription) {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { id: restaurantSellerId },
      select: { isApproved: true },
    })
    if (seller?.isApproved) {
      await assignFreePlanOnApproval(PlanType.RESTAURANT, restaurantSellerId)
      subscription = await prisma.restaurantSubscription.findUnique({
        where: { restaurantSellerId },
        include: { plan: true },
      })
    }
    if (!subscription) return null
  }

  // Apple IAP Guard
  if (subscription.provider === "apple_iap") {
    return subscription
  }

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
    const promoted = await promoteQueuedPackIfExists(PlanType.RESTAURANT, restaurantSellerId)
    if (promoted) {
      return promoted
    }

    if (subscription.status !== "EXPIRED") {
      await prisma.subscriptionPurchase.updateMany({
        where: {
          sellerType: PlanType.RESTAURANT,
          restaurantSellerId,
          status: "ACTIVE",
        },
        data: { status: "EXPIRED", expiredAt: now },
      })

      return await prisma.restaurantSubscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
        include: { plan: true },
      })
    }
    return subscription
  }

  return subscription
}





export async function checkHotelLimit(hotelSellerId: string): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getValidHotelSubscription(hotelSellerId)
  
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
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
  
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
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

// ==============================================================================
// PREPAID RECHARGE, STACKING & LIFECYCLE ENGINE
// ==============================================================================

export interface ActivateOrQueuePurchaseInput {
  purchaseId?: string
  sellerType: PlanType
  sellerId?: string | null
  hotelSellerId?: string | null
  restaurantSellerId?: string | null
  planId: string
  durationDays?: number
  price: number
  paidPrice: number
  discountAmount?: number
  couponCode?: string | null
  paymentMethod: string
  afriTxnId?: string | null
  afriFtxnId?: string | null
  afriMsisdn?: string | null
  flotOrderId?: string | null
  paidAt?: Date | null
  adminGrantedBy?: string | null
  note?: string | null
}

/**
 * Automatically assigns a 90-day Free Trial to a seller strictly upon Admin Approval.
 * Idempotent: Exactly 1 free trial is ever granted per seller.
 */
export async function assignFreePlanOnApproval(sellerType: PlanType, sellerId: string) {
  try {
    const [existing, existingCache] = await Promise.all([
      prisma.subscriptionPurchase.findFirst({
        where: {
          sellerType,
          ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId } : {}),
          ...(sellerType === PlanType.HOTEL ? { hotelSellerId: sellerId } : {}),
          ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: sellerId } : {}),
        },
      }),
      sellerType === PlanType.PRODUCT_SERVICE
        ? prisma.subscription.findUnique({ where: { sellerId } })
        : sellerType === PlanType.HOTEL
        ? prisma.hotelSubscription.findUnique({ where: { hotelSellerId: sellerId } })
        : prisma.restaurantSubscription.findUnique({ where: { restaurantSellerId: sellerId } }),
    ])

    if (existing || existingCache) {
      return null
    }

    const freePlan = await prisma.plan.findFirst({
      where: { price: 0, type: sellerType },
      orderBy: { duration: "desc" },
    })

    if (!freePlan) {
      console.warn(`[assignFreePlanOnApproval] No free plan found for ${sellerType}`)
      return null
    }

    const now = new Date()
    const durationDays = freePlan.duration || 90
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const snapshot = createPlanSnapshot(freePlan)

    const purchase = await prisma.subscriptionPurchase.create({
      data: {
        sellerType,
        sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : null,
        hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : null,
        restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : null,
        planId: freePlan.id,
        planSnapshot: snapshot,
        durationDays,
        price: 0,
        paidPrice: 0,
        status: "ACTIVE",
        periodStart: now,
        periodEnd,
        activatedAt: now,
        paymentMethod: "FREE_TRIAL",
        paidAt: now,
        note: "Initial 90-day free trial activated on admin approval",
      },
    })

    if (sellerType === PlanType.PRODUCT_SERVICE) {
      await prisma.subscription.upsert({
        where: { sellerId },
        create: {
          sellerId,
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
    } else if (sellerType === PlanType.HOTEL) {
      await prisma.hotelSubscription.upsert({
        where: { hotelSellerId: sellerId },
        create: {
          hotelSellerId: sellerId,
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
    } else {
      await prisma.restaurantSubscription.upsert({
        where: { restaurantSellerId: sellerId },
        create: {
          restaurantSellerId: sellerId,
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: freePlan.id,
          paidPrice: 0,
          paidAt: now,
          paymentMethod: "FREE_TRIAL",
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
    }

    return purchase
  } catch (error) {
    console.error(`[assignFreePlanOnApproval] Error:`, error)
    return null
  }
}

/**
 * Promotes the next QUEUED SubscriptionPurchase pack to ACTIVE when current active pack expires.
 */
export async function promoteQueuedPackIfExists(sellerType: PlanType, sellerId: string) {
  const now = new Date()

  const queuedPurchase = await prisma.subscriptionPurchase.findFirst({
    where: {
      sellerType,
      ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId } : {}),
      ...(sellerType === PlanType.HOTEL ? { hotelSellerId: sellerId } : {}),
      ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: sellerId } : {}),
      status: "QUEUED",
    },
    include: { plan: true },
    orderBy: { periodStart: "asc" },
  })

  if (!queuedPurchase) return null

  const durationDays = queuedPurchase.durationDays || queuedPurchase.plan.duration || 30
  const periodStart = now
  const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  // Mark previous ACTIVE purchases as EXPIRED
  await prisma.subscriptionPurchase.updateMany({
    where: {
      sellerType,
      ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId } : {}),
      ...(sellerType === PlanType.HOTEL ? { hotelSellerId: sellerId } : {}),
      ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: sellerId } : {}),
      status: "ACTIVE",
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  })

  // Promote QUEUED to ACTIVE
  await prisma.subscriptionPurchase.update({
    where: { id: queuedPurchase.id },
    data: {
      status: "ACTIVE",
      activatedAt: now,
      periodStart,
      periodEnd,
    },
  })

  // Sync to the corresponding cache table
  if (sellerType === PlanType.PRODUCT_SERVICE) {
    return await prisma.subscription.update({
      where: { sellerId },
      data: {
        planId: queuedPurchase.planId,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        paidPrice: queuedPurchase.paidPrice,
        paidAt: queuedPurchase.paidAt || now,
        paymentMethod: queuedPurchase.paymentMethod,
        planSnapshot: queuedPurchase.planSnapshot as any,
        afriTxnId: queuedPurchase.afriTxnId,
        afriFtxnId: queuedPurchase.afriFtxnId,
        afriMsisdn: queuedPurchase.afriMsisdn,
        flotOrderId: queuedPurchase.flotOrderId,
      },
      include: { plan: true },
    })
  } else if (sellerType === PlanType.HOTEL) {
    return await prisma.hotelSubscription.update({
      where: { hotelSellerId: sellerId },
      data: {
        planId: queuedPurchase.planId,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        paidPrice: queuedPurchase.paidPrice,
        paidAt: queuedPurchase.paidAt || now,
        paymentMethod: queuedPurchase.paymentMethod,
        planSnapshot: queuedPurchase.planSnapshot as any,
        afriTxnId: queuedPurchase.afriTxnId,
        afriFtxnId: queuedPurchase.afriFtxnId,
        afriMsisdn: queuedPurchase.afriMsisdn,
        flotOrderId: queuedPurchase.flotOrderId,
      },
      include: { plan: true },
    })
  } else {
    return await prisma.restaurantSubscription.update({
      where: { restaurantSellerId: sellerId },
      data: {
        planId: queuedPurchase.planId,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        paidPrice: queuedPurchase.paidPrice,
        paidAt: queuedPurchase.paidAt || now,
        paymentMethod: queuedPurchase.paymentMethod,
        planSnapshot: queuedPurchase.planSnapshot as any,
        afriTxnId: queuedPurchase.afriTxnId,
        afriFtxnId: queuedPurchase.afriFtxnId,
        afriMsisdn: queuedPurchase.afriMsisdn,
        flotOrderId: queuedPurchase.flotOrderId,
      },
      include: { plan: true },
    })
  }
}

/**
 * Universal activator / queueing handler for subscription recharges across Web, Mobile,
 * AfriMoney, Float, Stripe, Coupons, and Admin Grants.
 *
 * Implements:
 * 1. Decision G: Free trial days leftover are carried forward and stacked into paid pack duration.
 * 2. Active Paid Pack: Subsequent purchases become QUEUED and automatically start upon current pack expiry.
 * 3. Expired or Inactive: Activates immediately.
 * 4. 100% Idempotent.
 */
export async function activateOrQueuePurchase(input: ActivateOrQueuePurchaseInput) {
  const {
    purchaseId,
    sellerType,
    sellerId,
    hotelSellerId,
    restaurantSellerId,
    planId,
    durationDays = 30,
    price,
    paidPrice,
    discountAmount = 0,
    couponCode = null,
    paymentMethod,
    afriTxnId = null,
    afriFtxnId = null,
    afriMsisdn = null,
    flotOrderId = null,
    paidAt = new Date(),
    adminGrantedBy = null,
    note = null,
  } = input

  const now = new Date()

  // 1. Fetch Plan details for snapshot
  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) throw new Error(`Plan not found: ${planId}`)
  if (
    plan.price <= 0 &&
    !["FREE_TRIAL", "GO_LIVE_FREE_PERIOD", "ADMIN_GRANT"].includes(paymentMethod)
  ) {
    throw new Error(
      "Free introductory plan is only granted once upon admin approval and cannot be extended or purchased."
    )
  }
  const planSnapshot = createPlanSnapshot(plan)
  const effectiveDuration = durationDays || plan.duration || 30

  // 2. Load existing purchase if purchaseId provided
  let existingPurchase = purchaseId
    ? await prisma.subscriptionPurchase.findUnique({ where: { id: purchaseId } })
    : null

  // Idempotency check: If already processed, return immediately
  if (existingPurchase && (existingPurchase.status === "ACTIVE" || existingPurchase.status === "QUEUED")) {
    return {
      success: true,
      status: existingPurchase.status,
      purchase: existingPurchase,
      periodStart: existingPurchase.periodStart,
      periodEnd: existingPurchase.periodEnd,
    }
  }

  // 3. Inspect Current Active Subscription Cache
  let currentSub: any = null
  const effectiveSellerId = (sellerId || hotelSellerId || restaurantSellerId)!

  if (sellerType === PlanType.PRODUCT_SERVICE) {
    currentSub = await prisma.subscription.findUnique({
      where: { sellerId: effectiveSellerId },
      include: { plan: true },
    })
  } else if (sellerType === PlanType.HOTEL) {
    currentSub = await prisma.hotelSubscription.findUnique({
      where: { hotelSellerId: effectiveSellerId },
      include: { plan: true },
    })
  } else {
    currentSub = await prisma.restaurantSubscription.findUnique({
      where: { restaurantSellerId: effectiveSellerId },
      include: { plan: true },
    })
  }

  const isCurrentActive =
    currentSub &&
    (currentSub.status === "ACTIVE" || currentSub.status === "TRIALING") &&
    currentSub.currentPeriodEnd &&
    new Date(currentSub.currentPeriodEnd) > now

  let targetStatus: "ACTIVE" | "QUEUED" = "ACTIVE"
  let periodStart: Date = now
  let periodEnd: Date = new Date(now.getTime() + effectiveDuration * 24 * 60 * 60 * 1000)

  if (isCurrentActive) {
    const isFreePlan = currentSub.plan.price === 0

    if (isFreePlan) {
      // Decision G: Carry-forward leftover free trial days!
      const currentEnd = new Date(currentSub.currentPeriodEnd)
      const remainingFreeMs = Math.max(0, currentEnd.getTime() - now.getTime())
      const remainingFreeDays = Math.ceil(remainingFreeMs / (24 * 60 * 60 * 1000))
      const totalDays = remainingFreeDays + effectiveDuration

      periodStart = now
      periodEnd = new Date(now.getTime() + totalDays * 24 * 60 * 60 * 1000)
      targetStatus = "ACTIVE"

      // Mark any prior active free trial purchase as EXPIRED
      await prisma.subscriptionPurchase.updateMany({
        where: {
          sellerType,
          ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId: effectiveSellerId } : {}),
          ...(sellerType === PlanType.HOTEL ? { hotelSellerId: effectiveSellerId } : {}),
          ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: effectiveSellerId } : {}),
          status: "ACTIVE",
        },
        data: { status: "EXPIRED", expiredAt: now },
      })
    } else {
      // Paid plan already running -> Queue the new pack!
      targetStatus = "QUEUED"

      // Find the furthest periodEnd among ACTIVE and QUEUED purchases
      const latestPack = await prisma.subscriptionPurchase.findFirst({
        where: {
          sellerType,
          ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId: effectiveSellerId } : {}),
          ...(sellerType === PlanType.HOTEL ? { hotelSellerId: effectiveSellerId } : {}),
          ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: effectiveSellerId } : {}),
          status: { in: ["ACTIVE", "QUEUED"] },
        },
        orderBy: { periodEnd: "desc" },
      })

      const baseEnd = latestPack?.periodEnd && new Date(latestPack.periodEnd) > new Date(currentSub.currentPeriodEnd)
        ? new Date(latestPack.periodEnd)
        : new Date(currentSub.currentPeriodEnd)

      periodStart = baseEnd
      periodEnd = new Date(baseEnd.getTime() + effectiveDuration * 24 * 60 * 60 * 1000)
    }
  } else {
    // No active subscription or expired -> activates immediately
    targetStatus = "ACTIVE"
    periodStart = now
    periodEnd = new Date(now.getTime() + effectiveDuration * 24 * 60 * 60 * 1000)

    // Mark any prior purchases as EXPIRED
    await prisma.subscriptionPurchase.updateMany({
      where: {
        sellerType,
        ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId: effectiveSellerId } : {}),
        ...(sellerType === PlanType.HOTEL ? { hotelSellerId: effectiveSellerId } : {}),
        ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: effectiveSellerId } : {}),
        status: "ACTIVE",
      },
      data: { status: "EXPIRED", expiredAt: now },
    })
  }

  // 4. Save to SubscriptionPurchase ledger
  let purchase
  if (existingPurchase) {
    purchase = await prisma.subscriptionPurchase.update({
      where: { id: existingPurchase.id },
      data: {
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays: effectiveDuration,
        price,
        paidPrice,
        discountAmount,
        couponCode,
        status: targetStatus,
        periodStart,
        periodEnd,
        activatedAt: targetStatus === "ACTIVE" ? now : null,
        paymentMethod,
        afriTxnId: afriTxnId || existingPurchase.afriTxnId,
        afriFtxnId: afriFtxnId || existingPurchase.afriFtxnId,
        afriMsisdn: afriMsisdn || existingPurchase.afriMsisdn,
        flotOrderId: flotOrderId || existingPurchase.flotOrderId,
        paidAt: paidAt || now,
        adminGrantedBy: adminGrantedBy || existingPurchase.adminGrantedBy,
        note: note || existingPurchase.note,
      },
      include: { plan: true },
    })
  } else {
    purchase = await prisma.subscriptionPurchase.create({
      data: {
        sellerType,
        sellerId: sellerType === PlanType.PRODUCT_SERVICE ? effectiveSellerId : null,
        hotelSellerId: sellerType === PlanType.HOTEL ? effectiveSellerId : null,
        restaurantSellerId: sellerType === PlanType.RESTAURANT ? effectiveSellerId : null,
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays: effectiveDuration,
        price,
        paidPrice,
        discountAmount,
        couponCode,
        status: targetStatus,
        periodStart,
        periodEnd,
        activatedAt: targetStatus === "ACTIVE" ? now : null,
        paymentMethod,
        afriTxnId,
        afriFtxnId,
        afriMsisdn,
        flotOrderId,
        paidAt: paidAt || now,
        adminGrantedBy,
        note,
      },
      include: { plan: true },
    })
  }

  // 4b. Record coupon usage idempotently if coupon was used
  if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
    try {
      const codeUpper = couponCode.trim().toUpperCase()
      const coupon = await prisma.coupon.findFirst({
        where: { code: codeUpper },
      })
      if (coupon) {
        let subUserId: string | null = null
        if (sellerType === PlanType.PRODUCT_SERVICE) {
          const s = await prisma.seller.findUnique({
            where: { id: effectiveSellerId },
            select: { userId: true },
          })
          subUserId = s?.userId || null
        } else if (sellerType === PlanType.HOTEL) {
          const s = await prisma.hotelSeller.findUnique({
            where: { id: effectiveSellerId },
            select: { userId: true },
          })
          subUserId = s?.userId || null
        } else if (sellerType === PlanType.RESTAURANT) {
          const s = await prisma.restaurantSeller.findUnique({
            where: { id: effectiveSellerId },
            select: { userId: true },
          })
          subUserId = s?.userId || null
        }

        if (subUserId) {
          const existingUsage = await prisma.couponUsage.findFirst({
            where: {
              couponId: coupon.id,
              subscriptionId: purchase.id,
            },
          })
          if (!existingUsage) {
            await recordSellerCouponUsage({
              couponId: coupon.id,
              userId: subUserId,
              subscriptionId: purchase.id,
            })
          }
        }
      }
    } catch (e) {
      console.warn("[activateOrQueuePurchase] Error recording coupon usage:", e)
    }
  }

  // 5. If ACTIVE, sync to the corresponding cache table
  if (targetStatus === "ACTIVE") {
    if (sellerType === PlanType.PRODUCT_SERVICE) {
      await prisma.subscription.upsert({
        where: { sellerId: effectiveSellerId },
        create: {
          sellerId: effectiveSellerId,
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId,
          afriFtxnId,
          afriMsisdn,
          flotOrderId,
        },
        update: {
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId: afriTxnId || undefined,
          afriFtxnId: afriFtxnId || undefined,
          afriMsisdn: afriMsisdn || undefined,
          flotOrderId: flotOrderId || undefined,
        },
      })
    } else if (sellerType === PlanType.HOTEL) {
      await prisma.hotelSubscription.upsert({
        where: { hotelSellerId: effectiveSellerId },
        create: {
          hotelSellerId: effectiveSellerId,
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId,
          afriFtxnId,
          afriMsisdn,
          flotOrderId,
        },
        update: {
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId: afriTxnId || undefined,
          afriFtxnId: afriFtxnId || undefined,
          afriMsisdn: afriMsisdn || undefined,
          flotOrderId: flotOrderId || undefined,
        },
      })
    } else {
      await prisma.restaurantSubscription.upsert({
        where: { restaurantSellerId: effectiveSellerId },
        create: {
          restaurantSellerId: effectiveSellerId,
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId,
          afriFtxnId,
          afriMsisdn,
          flotOrderId,
        },
        update: {
          planId: plan.id,
          paidPrice,
          paidAt: paidAt || now,
          paymentMethod,
          planSnapshot: planSnapshot as any,
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          afriTxnId: afriTxnId || undefined,
          afriFtxnId: afriFtxnId || undefined,
          afriMsisdn: afriMsisdn || undefined,
          flotOrderId: flotOrderId || undefined,
        },
      })
    }
  }

  return {
    success: true,
    status: targetStatus,
    purchase,
    periodStart,
    periodEnd,
  }
}

/**
 * Subscription Visibility Gate:
 * Controls whether marketplace items of expired sellers are hidden from customer views.
 * Default is ON. Set SUBSCRIPTION_VISIBILITY_GATE=off to immediately disable if needed.
 */
export function isSubscriptionVisibilityGateEnabled(): boolean {
  const flag = process.env.SUBSCRIPTION_VISIBILITY_GATE
  if (flag === "off" || flag === "false") {
    return false
  }
  return true
}

/**
 * Reusable Prisma filter for an active subscription cache row.
 * Includes both standard paid/free-trial active packs (currentPeriodEnd > now)
 * and Apple IAP managed subscriptions.
 */
export function activeSubscriptionWhere(now: Date = new Date()) {
  if (!isSubscriptionVisibilityGateEnabled()) {
    return undefined
  }
  return {
    OR: [
      {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.IN_GRACE_PERIOD] },
        currentPeriodEnd: { gt: now },
      },
      {
        provider: "apple_iap",
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.IN_GRACE_PERIOD] },
      },
    ],
  }
}

/**
 * Filter for Product & Service Sellers:
 * isApproved: true, isSuspended: false, and active subscription.
 */
export function activeProductSellerWhere(now: Date = new Date()) {
  const subWhere = activeSubscriptionWhere(now)
  return {
    isApproved: true,
    isSuspended: false,
    ...(subWhere ? { subscription: subWhere } : {}),
  }
}

/**
 * Filter for Hotel Sellers:
 * isApproved: true, isSuspended: false, and active subscription.
 */
export function activeHotelSellerWhere(now: Date = new Date()) {
  const subWhere = activeSubscriptionWhere(now)
  return {
    isApproved: true,
    isSuspended: false,
    ...(subWhere ? { subscription: subWhere } : {}),
  }
}

/**
 * Filter for Restaurant Sellers:
 * isApproved: true, isSuspended: false, and active subscription.
 */
export function activeRestaurantSellerWhere(now: Date = new Date()) {
  const subWhere = activeSubscriptionWhere(now)
  return {
    isApproved: true,
    isSuspended: false,
    ...(subWhere ? { subscription: subWhere } : {}),
  }
}

/**
 * Check whether a specific seller's subscription is currently active.
 */
export async function isSellerSubscriptionActive(
  sellerType: PlanType,
  sellerId: string
): Promise<boolean> {
  if (!isSubscriptionVisibilityGateEnabled()) return true

  const now = new Date()
  if (sellerType === PlanType.PRODUCT_SERVICE) {
    const sub = await prisma.subscription.findUnique({
      where: { sellerId },
      select: { status: true, currentPeriodEnd: true, provider: true },
    })
    if (!sub) return false
    if (sub.provider === "apple_iap") {
      return sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD"
    }
    return (
      (sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD") &&
      !!sub.currentPeriodEnd &&
      sub.currentPeriodEnd > now
    )
  } else if (sellerType === PlanType.HOTEL) {
    const sub = await prisma.hotelSubscription.findUnique({
      where: { hotelSellerId: sellerId },
      select: { status: true, currentPeriodEnd: true, provider: true },
    })
    if (!sub) return false
    if (sub.provider === "apple_iap") {
      return sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD"
    }
    return (
      (sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD") &&
      !!sub.currentPeriodEnd &&
      sub.currentPeriodEnd > now
    )
  } else if (sellerType === PlanType.RESTAURANT) {
    const sub = await prisma.restaurantSubscription.findUnique({
      where: { restaurantSellerId: sellerId },
      select: { status: true, currentPeriodEnd: true, provider: true },
    })
    if (!sub) return false
    if (sub.provider === "apple_iap") {
      return sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD"
    }
    return (
      (sub.status === "ACTIVE" || sub.status === "IN_GRACE_PERIOD") &&
      !!sub.currentPeriodEnd &&
      sub.currentPeriodEnd > now
    )
  }
  return false
}

/**
 * Check limit for adding new restaurant food items.
 */
export async function checkRestaurantFoodLimit(
  restaurantSellerId: string
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const subscription = await getValidRestaurantSubscription(restaurantSellerId)
  if (!subscription || !isSubscriptionPrivileged(subscription)) {
    return { allowed: false, current: 0, limit: 0 }
  }

  const planMaxProducts = subscription.plan.maxProducts
  if (planMaxProducts === null) {
    return { allowed: true, current: 0, limit: null }
  }

  const currentCount = await prisma.foodItem.count({
    where: { restaurantSellerId, isDeleted: false },
  })

  return {
    allowed: currentCount < planMaxProducts,
    current: currentCount,
    limit: planMaxProducts,
  }
}


export interface InitiateAfriMoneySubscriptionParams {
  sellerType: PlanType
  sellerId: string
  planId: string
  payerMsisdn: string
  couponCode?: string | null
  userId?: string
}

export interface InitiateAfriMoneySubscriptionResult {
  success: boolean
  purchaseId?: string
  status?: "ACTIVE" | "QUEUED"
  ftxnId?: string
  txnId?: string
  payableAmount: number
  planName?: string
  message: string
  error?: string
}

/**
 * Initiate an AfriMoney Push USSD Subscription Payment.
 * Generates an idempotent SUB_{TYPE}_{id} external reference, records into SubscriptionPurchase ledger,
 * and sends Push USSD directly to the seller's Africell handset.
 */
export async function initiateAfriMoneySubscriptionPayment(
  params: InitiateAfriMoneySubscriptionParams
): Promise<InitiateAfriMoneySubscriptionResult> {
  const { sellerType, sellerId, planId, payerMsisdn, couponCode, userId } = params

  // 1. Validate Plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  })

  if (!plan) {
    return {
      success: false,
      payableAmount: 0,
      message: "Plan not found",
      error: "Plan not found",
    }
  }

  if (plan.type !== sellerType && !(sellerType === PlanType.PRODUCT_SERVICE && plan.type === PlanType.PRODUCT_SERVICE)) {
    return {
      success: false,
      payableAmount: 0,
      message: `Plan type mismatch: expected ${sellerType}, got ${plan.type}`,
      error: "Plan type mismatch",
    }
  }

  if (plan.price <= 0) {
    return {
      success: false,
      payableAmount: 0,
      message: "The free introductory trial plan cannot be repurchased. Please select a paid package.",
      error: "The free trial plan cannot be repurchased.",
    }
  }

  // 2. Process Coupon if provided (before MSISDN validation so 100% coupons work without phone)
  let discountAmount = 0
  if (couponCode && couponCode.trim()) {
    const couponValidation = await validateSellerCoupon({
      code: couponCode.trim(),
      amount: plan.price,
      userId: userId || sellerId,
    })
    if (!couponValidation.valid) {
      return {
        success: false,
        payableAmount: plan.price,
        message: couponValidation.error || "Invalid coupon code",
        error: couponValidation.error || "Invalid coupon code",
      }
    }
    discountAmount = couponValidation.discountAmount || 0
  }

  const payableAmount = Math.max(0, plan.price - discountAmount)
  const durationDays = plan.duration || 30
  const planSnapshot = createPlanSnapshot(plan)

  // 3. Handle 100% Coupon (zero payable)
  if (payableAmount === 0) {
    const activation = await activateOrQueuePurchase({
      sellerType,
      sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : undefined,
      hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : undefined,
      restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : undefined,
      planId: plan.id,
      durationDays,
      paymentMethod: "COUPON_100_PERCENT",
      price: plan.price,
      paidPrice: 0,
      discountAmount,
      couponCode: couponCode?.trim().toUpperCase() || null,
      paidAt: new Date(),
    })

    return {
      success: true,
      purchaseId: activation.purchase.id,
      status: activation.status,
      payableAmount: 0,
      planName: plan.displayName || plan.name,
      message:
        activation.status === "QUEUED"
          ? "100% coupon applied! Your pack has been queued successfully."
          : "100% coupon applied! Your plan is activated successfully.",
    }
  }

  // 4. Validate MSISDN (Africell Sierra Leone format) for non-zero AfriMoney payments
  const cleanMsisdn = (payerMsisdn || "").replace(/[^0-9]/g, "")
  if (!cleanMsisdn || cleanMsisdn.length < 8) {
    return {
      success: false,
      payableAmount,
      message: "Please enter a valid Africell mobile number",
      error: "Invalid phone number",
    }
  }

  // 5. Check if there is an active pending purchase created in the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const existingPending = await prisma.subscriptionPurchase.findFirst({
    where: {
      sellerType,
      sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : null,
      hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : null,
      restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : null,
      status: SubscriptionLedgerStatus.PENDING_PAYMENT,
      createdAt: { gte: fifteenMinutesAgo },
    },
    include: { plan: true },
  })

  // 6. Create or update SubscriptionPurchase row
  let purchase: any
  let prefix = "PROD"
  if (sellerType === PlanType.HOTEL) prefix = "HOTEL"
  if (sellerType === PlanType.RESTAURANT) prefix = "REST"

  if (existingPending) {
    const ftxnId = existingPending.afriFtxnId || `SUB_${prefix}_${existingPending.id}`
    purchase = await prisma.subscriptionPurchase.update({
      where: { id: existingPending.id },
      data: {
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays,
        price: plan.price,
        paidPrice: payableAmount,
        discountAmount,
        couponCode: couponCode?.trim().toUpperCase() || null,
        afriMsisdn: payerMsisdn,
        afriFtxnId: ftxnId,
      },
      include: { plan: true },
    })
  } else {
    purchase = await prisma.subscriptionPurchase.create({
      data: {
        sellerType,
        sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : null,
        hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : null,
        restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : null,
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays,
        price: plan.price,
        paidPrice: payableAmount,
        discountAmount,
        couponCode: couponCode?.trim() || null,
        status: SubscriptionLedgerStatus.PENDING_PAYMENT,
        paymentMethod: "AFRIMONEY",
        afriMsisdn: payerMsisdn,
      },
      include: { plan: true },
    })

    const ftxnId = `SUB_${prefix}_${purchase.id}`
    purchase = await prisma.subscriptionPurchase.update({
      where: { id: purchase.id },
      data: { afriFtxnId: ftxnId },
      include: { plan: true },
    })
  }

  // 7. Dispatch Push USSD to Africell network
  const ussdRes = await initiateAfriMoneyPushUssd({
    amount: payableAmount,
    payerMsisdn,
    externalReferenceId: purchase.afriFtxnId || `SUB_${prefix}_${purchase.id}`,
    remarks: `MEEEM Sub: ${(plan.displayName || plan.name).slice(0, 20)}`,
  })

  if (!ussdRes.success) {
    return {
      success: false,
      purchaseId: purchase.id,
      ftxnId: purchase.afriFtxnId || undefined,
      payableAmount,
      planName: plan.displayName || plan.name,
      message: ussdRes.message || "Failed to initiate AfriMoney Push USSD prompt",
      error: ussdRes.message || "Failed to initiate AfriMoney Push USSD prompt",
    }
  }

  if (ussdRes.txnId) {
    await prisma.subscriptionPurchase.update({
      where: { id: purchase.id },
      data: { afriTxnId: ussdRes.txnId },
    })
  }

  return {
    success: true,
    purchaseId: purchase.id,
    ftxnId: purchase.afriFtxnId || undefined,
    txnId: ussdRes.txnId,
    payableAmount,
    planName: plan.displayName || plan.name,
    message: "USSD payment prompt sent to your handset! Please enter your AfriMoney PIN to approve.",
  }
}

/**
 * 3-second polling / verification endpoint helper.
 * Returns live status of a SubscriptionPurchase (PENDING_PAYMENT, ACTIVE, QUEUED, FAILED).
 * Auto-times out pending purchases after 15 minutes.
 */
export async function verifySubscriptionPaymentStatus(purchaseId: string) {
  const purchase = await prisma.subscriptionPurchase.findUnique({
    where: { id: purchaseId },
    include: { plan: true },
  })

  if (!purchase) {
    return { success: false, error: "Subscription purchase record not found" }
  }

  // Check 15-minute timeout for stuck pending payments
  if (purchase.status === SubscriptionLedgerStatus.PENDING_PAYMENT) {
    if (purchase.paymentMethod === "FLOAT" && purchase.flotOrderId) {
      await reconcileFloatSubscriptionPurchase(purchase.id).catch(() => null)
      const reloaded = await prisma.subscriptionPurchase.findUnique({
        where: { id: purchase.id },
        include: { plan: true },
      })
      if (reloaded) {
        return {
          success: true,
          purchaseId: reloaded.id,
          status: reloaded.status,
          isReady: reloaded.status === SubscriptionLedgerStatus.ACTIVE || reloaded.status === SubscriptionLedgerStatus.QUEUED,
          isFailed: reloaded.status === SubscriptionLedgerStatus.FAILED || reloaded.status === SubscriptionLedgerStatus.CANCELLED,
          planName: reloaded.plan?.displayName || reloaded.plan?.name,
          periodStart: reloaded.periodStart,
          periodEnd: reloaded.periodEnd,
          durationDays: reloaded.durationDays,
          paidPrice: reloaded.paidPrice,
          paymentMethod: reloaded.paymentMethod,
          flotOrderId: reloaded.flotOrderId,
          afriTxnId: reloaded.afriTxnId,
          message:
            reloaded.status === SubscriptionLedgerStatus.ACTIVE
              ? "Subscription pack activated successfully!"
              : reloaded.status === SubscriptionLedgerStatus.QUEUED
              ? "Subscription pack queued successfully! It will start automatically when your current pack ends."
              : reloaded.status === SubscriptionLedgerStatus.PENDING_PAYMENT
              ? "Payment is still processing in Float portal. Please finish checkout or click Re-check Status."
              : "Payment was not completed.",
        }
      }
    }

    const ageMs = Date.now() - purchase.createdAt.getTime()
    if (ageMs > 15 * 60 * 1000) {
      const updated = await prisma.subscriptionPurchase.update({
        where: { id: purchase.id },
        data: { status: SubscriptionLedgerStatus.FAILED },
        include: { plan: true },
      })
      return {
        success: true,
        purchaseId: updated.id,
        status: SubscriptionLedgerStatus.FAILED,
        isReady: false,
        isFailed: true,
        message: "Payment request timed out after 15 minutes. Please try again.",
      }
    }
  }

  const isReady =
    purchase.status === SubscriptionLedgerStatus.ACTIVE ||
    purchase.status === SubscriptionLedgerStatus.QUEUED

  const isFailed =
    purchase.status === SubscriptionLedgerStatus.FAILED ||
    purchase.status === SubscriptionLedgerStatus.CANCELLED

  return {
    success: true,
    purchaseId: purchase.id,
    status: purchase.status,
    isReady,
    isFailed,
    planName: purchase.plan?.displayName || purchase.plan?.name,
    periodStart: purchase.periodStart,
    periodEnd: purchase.periodEnd,
    durationDays: purchase.durationDays,
    paidPrice: purchase.paidPrice,
    paymentMethod: purchase.paymentMethod,
    flotOrderId: purchase.flotOrderId,
    afriTxnId: purchase.afriTxnId,
    message:
      purchase.status === SubscriptionLedgerStatus.ACTIVE
        ? "Subscription pack activated successfully!"
        : purchase.status === SubscriptionLedgerStatus.QUEUED
        ? "Subscription pack queued successfully! It will start automatically when your current pack ends."
        : purchase.status === SubscriptionLedgerStatus.PENDING_PAYMENT
        ? "Payment is still processing. Please enter your AfriMoney PIN on your phone or complete card payment."
        : "Payment was not completed.",
  }
}

export interface InitiateFloatSubscriptionParams {
  sellerType: PlanType
  sellerId: string
  planId: string
  couponCode?: string | null
  userId?: string
}

export interface InitiateFloatSubscriptionResult {
  success: boolean
  purchaseId?: string
  status?: string
  payableAmount: number
  planName?: string
  paymentUrl?: string | null
  flotOrderId?: string | null
  message?: string
  error?: string
}

/**
 * Initiate Float Payment Link for Subscription Purchase.
 */
export async function initiateFloatSubscriptionPayment(
  params: InitiateFloatSubscriptionParams
): Promise<InitiateFloatSubscriptionResult> {
  const { sellerType, sellerId, planId, couponCode, userId } = params

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  })

  if (!plan) {
    return {
      success: false,
      payableAmount: 0,
      message: "Plan not found",
      error: "Plan not found",
    }
  }

  if (plan.price <= 0) {
    return {
      success: false,
      payableAmount: 0,
      message: "The free introductory trial plan cannot be repurchased. Please select a paid package.",
      error: "The free trial plan cannot be repurchased.",
    }
  }

  let discountAmount = 0
  if (couponCode && couponCode.trim()) {
    const couponValidation = await validateSellerCoupon({
      code: couponCode.trim(),
      amount: plan.price,
      userId: userId || sellerId,
    })
    if (!couponValidation.valid) {
      return {
        success: false,
        payableAmount: plan.price,
        message: couponValidation.error || "Invalid coupon code",
        error: couponValidation.error || "Invalid coupon code",
      }
    }
    discountAmount = couponValidation.discountAmount || 0
  }

  const payableAmount = Math.max(0, plan.price - discountAmount)
  const durationDays = plan.duration || 30
  const planSnapshot = createPlanSnapshot(plan)

  // 100% Coupon: Activate immediately
  if (payableAmount === 0) {
    const activation = await activateOrQueuePurchase({
      sellerType,
      sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : undefined,
      hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : undefined,
      restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : undefined,
      planId: plan.id,
      durationDays,
      paymentMethod: "COUPON_100_PERCENT",
      price: plan.price,
      paidPrice: 0,
      discountAmount,
      couponCode: couponCode?.trim().toUpperCase() || null,
      paidAt: new Date(),
    })

    return {
      success: true,
      purchaseId: activation.purchase.id,
      status: activation.status,
      payableAmount: 0,
      planName: plan.displayName || plan.name,
      message:
        activation.status === "QUEUED"
          ? "100% coupon applied! Your pack has been queued successfully."
          : "100% coupon applied! Your plan is activated successfully.",
    }
  }

  let prefix = "PROD"
  if (sellerType === PlanType.HOTEL) prefix = "HOTEL"
  if (sellerType === PlanType.RESTAURANT) prefix = "REST"

  // Reuse existing pending purchase if created within 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const existingPending = await prisma.subscriptionPurchase.findFirst({
    where: {
      sellerType,
      sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : null,
      hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : null,
      restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : null,
      status: SubscriptionLedgerStatus.PENDING_PAYMENT,
      createdAt: { gte: fifteenMinutesAgo },
    },
    include: { plan: true },
  })

  let purchase: any
  if (existingPending) {
    purchase = await prisma.subscriptionPurchase.update({
      where: { id: existingPending.id },
      data: {
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays,
        price: plan.price,
        paidPrice: payableAmount,
        discountAmount,
        couponCode: couponCode?.trim().toUpperCase() || null,
        paymentMethod: "FLOAT",
      },
      include: { plan: true },
    })
  } else {
    purchase = await prisma.subscriptionPurchase.create({
      data: {
        sellerType,
        sellerId: sellerType === PlanType.PRODUCT_SERVICE ? sellerId : null,
        hotelSellerId: sellerType === PlanType.HOTEL ? sellerId : null,
        restaurantSellerId: sellerType === PlanType.RESTAURANT ? sellerId : null,
        planId: plan.id,
        planSnapshot: planSnapshot as any,
        durationDays,
        price: plan.price,
        paidPrice: payableAmount,
        discountAmount,
        couponCode: couponCode?.trim().toUpperCase() || null,
        status: SubscriptionLedgerStatus.PENDING_PAYMENT,
        paymentMethod: "FLOAT",
      },
      include: { plan: true },
    })
  }

  const flotOrderId = `SUB_${prefix}_${purchase.id}`

  try {
    const flotRes = await createFlotPaymentLink({
      orderId: flotOrderId,
      amount: payableAmount,
      type: "card",
    })

    await prisma.subscriptionPurchase.update({
      where: { id: purchase.id },
      data: {
        flotOrderId,
        flotInternalOrderId: flotRes.id,
        flotPaymentLink: flotRes.link,
      },
    })

    return {
      success: true,
      purchaseId: purchase.id,
      payableAmount,
      planName: plan.displayName || plan.name,
      paymentUrl: flotRes.link,
      flotOrderId,
      message: "Float checkout link generated successfully",
    }
  } catch (error: any) {
    console.error("[Float Subscription] Error generating payment link:", error)
    return {
      success: false,
      purchaseId: purchase.id,
      payableAmount,
      planName: plan.displayName || plan.name,
      error: error?.message || "Failed to create Float payment link. Please try again or use AfriMoney.",
    }
  }
}

/**
 * Reconcile a Float subscription purchase status with Float Gateway API.
 */
export async function reconcileFloatSubscriptionPurchase(purchaseId: string) {
  const purchase = await prisma.subscriptionPurchase.findUnique({
    where: { id: purchaseId },
    include: { plan: true },
  })

  if (!purchase) return { success: false, error: "Purchase not found" }
  if (purchase.status === "ACTIVE" || purchase.status === "QUEUED") {
    return { success: true, paid: true, status: purchase.status }
  }

  if (purchase.flotOrderId && purchase.flotInternalOrderId) {
    try {
      const attempt = await verifyFlotPaymentAttempt({
        externalOrderId: purchase.flotOrderId,
        internalOrderId: purchase.flotInternalOrderId,
      })

      if (attempt?.status === "completed") {
        const activation = await activateOrQueuePurchase({
          purchaseId: purchase.id,
          sellerType: purchase.sellerType,
          sellerId: purchase.sellerId,
          hotelSellerId: purchase.hotelSellerId,
          restaurantSellerId: purchase.restaurantSellerId,
          planId: purchase.planId,
          price: purchase.price,
          paidPrice: purchase.paidPrice,
          discountAmount: purchase.discountAmount,
          couponCode: purchase.couponCode,
          durationDays: purchase.durationDays,
          paymentMethod: "FLOAT",
          flotOrderId: purchase.flotOrderId,
          paidAt: new Date(),
        })

        return {
          success: true,
          paid: true,
          status: activation.status,
        }
      } else if (attempt?.status === "failed") {
        await prisma.subscriptionPurchase.update({
          where: { id: purchase.id },
          data: { status: "FAILED" },
        })
        return {
          success: true,
          paid: false,
          status: "FAILED",
        }
      }
    } catch (e) {
      console.error("[reconcileFloatSubscriptionPurchase] Error checking Float status:", e)
    }
  }

  return {
    success: true,
    paid: false,
    status: purchase.status,
  }
}

