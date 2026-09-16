import { NextRequest } from "next/server"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { prisma } from "@/lib/prisma"
import { UserRole, SubscriptionStatus, PlanType, Plan } from "@prisma/client"
import { JWSTransactionDecodedPayload } from "@apple/app-store-server-library"

export type UnifiedSellerAuth =
  | {
      ok: true
      userId: string
      role: UserRole
      sellerType: PlanType
      sellerRecordId: string
    }
  | {
      ok: false
      status: number
      error: string
    }

/**
 * Universal Mobile Auth resolving all 4 seller types:
 * - SELLER_PRODUCT & SELLER_SERVICE -> PlanType.PRODUCT_SERVICE
 * - SELLER_HOTEL -> PlanType.HOTEL
 * - SELLER_RESTAURANT -> PlanType.RESTAURANT
 */
export async function getUnifiedMobileSellerAuth(
  request: NextRequest
): Promise<UnifiedSellerAuth> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing or invalid authorization header" }
  }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)

  if (!payload || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, status: 401, error: "Unauthorized or expired token" }
  }

  const role = payload.role as UserRole
  const userId = payload.userId

  if (role === UserRole.SELLER_PRODUCT || role === UserRole.SELLER_SERVICE) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!seller) {
      return { ok: false, status: 404, error: "Product/Service Seller record not found" }
    }
    return {
      ok: true,
      userId,
      role,
      sellerType: PlanType.PRODUCT_SERVICE,
      sellerRecordId: seller.id,
    }
  }

  if (role === UserRole.SELLER_HOTEL) {
    const hotelSeller = await prisma.hotelSeller.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!hotelSeller) {
      return { ok: false, status: 404, error: "Hotel Seller record not found" }
    }
    return {
      ok: true,
      userId,
      role,
      sellerType: PlanType.HOTEL,
      sellerRecordId: hotelSeller.id,
    }
  }

  if (role === UserRole.SELLER_RESTAURANT) {
    const restaurantSeller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!restaurantSeller) {
      return { ok: false, status: 404, error: "Restaurant Seller record not found" }
    }
    return {
      ok: true,
      userId,
      role,
      sellerType: PlanType.RESTAURANT,
      sellerRecordId: restaurantSeller.id,
    }
  }

  return { ok: false, status: 403, error: "Forbidden: User is not a recognized seller" }
}

/**
 * Anti-fraud guard: Ensure an Apple originalTransactionId is not already bound
 * to a different seller account in ANY of the 3 subscription tables.
 */
export async function assertNoTransactionConflict(
  originalTransactionId: string,
  sellerAuth: { sellerType: PlanType; sellerRecordId: string; userId?: string }
): Promise<void> {
  if (!originalTransactionId) return

  const [subConflict, hotelConflict, restConflict] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        originalTransactionId,
        ...(sellerAuth.sellerType === PlanType.PRODUCT_SERVICE
          ? { sellerId: { not: sellerAuth.sellerRecordId } }
          : {}),
      },
      select: { id: true, seller: { select: { userId: true } } },
    }),
    prisma.hotelSubscription.findFirst({
      where: {
        originalTransactionId,
        ...(sellerAuth.sellerType === PlanType.HOTEL
          ? { hotelSellerId: { not: sellerAuth.sellerRecordId } }
          : {}),
      },
      select: { id: true, hotelSeller: { select: { userId: true } } },
    }),
    prisma.restaurantSubscription.findFirst({
      where: {
        originalTransactionId,
        ...(sellerAuth.sellerType === PlanType.RESTAURANT
          ? { restaurantSellerId: { not: sellerAuth.sellerRecordId } }
          : {}),
      },
      select: { id: true, restaurantSeller: { select: { userId: true } } },
    }),
  ])

  const isConflictDifferentUser = (conflictUserId?: string | null) => {
    if (!conflictUserId) return true
    if (sellerAuth.userId) {
      return conflictUserId !== sellerAuth.userId
    }
    return true
  }

  if (
    (subConflict && isConflictDifferentUser(subConflict.seller?.userId)) ||
    (hotelConflict && isConflictDifferentUser(hotelConflict.hotelSeller?.userId)) ||
    (restConflict && isConflictDifferentUser(restConflict.restaurantSeller?.userId))
  ) {
    throw new Error(
      "This Apple Subscription is already registered to another seller account."
    )
  }
}

/**
 * Get current subscription for a seller across any of the 3 subscription types.
 */
export async function getCurrentSellerSubscription(
  sellerAuth: { sellerType: PlanType; sellerRecordId: string }
) {
  if (sellerAuth.sellerType === PlanType.PRODUCT_SERVICE) {
    return await prisma.subscription.findUnique({
      where: { sellerId: sellerAuth.sellerRecordId },
      include: { plan: true },
    })
  }

  if (sellerAuth.sellerType === PlanType.HOTEL) {
    return await prisma.hotelSubscription.findUnique({
      where: { hotelSellerId: sellerAuth.sellerRecordId },
      include: { plan: true },
    })
  }

  return await prisma.restaurantSubscription.findUnique({
    where: { restaurantSellerId: sellerAuth.sellerRecordId },
    include: { plan: true },
  })
}

/**
 * Activate or update an Apple IAP subscription for any seller type.
 */
export async function activateAppleIapSubscription(
  sellerAuth: { sellerType: PlanType; sellerRecordId: string },
  plan: Plan,
  txn: JWSTransactionDecodedPayload
) {
  const originalTransactionId = txn.originalTransactionId
  if (!originalTransactionId) {
    throw new Error("Missing originalTransactionId in Apple transaction payload")
  }

  // Anti-fraud check
  await assertNoTransactionConflict(originalTransactionId, sellerAuth)

  const startDate = txn.purchaseDate ? new Date(txn.purchaseDate) : new Date()
  const endDate = txn.expiresDate
    ? new Date(txn.expiresDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const planSnapshot = {
    id: plan.id,
    name: plan.name,
    type: plan.type,
    displayName: plan.displayName,
    price: plan.price,
    duration: plan.duration,
    maxProducts: plan.maxProducts,
    maxOrders: plan.maxOrders,
    maxRooms: plan.maxRooms,
    features: plan.features,
    frozenAt: new Date().toISOString(),
  }

  const commonData = {
    planId: plan.id,
    status: SubscriptionStatus.ACTIVE,
    provider: "apple_iap",
    appleProductId: txn.productId,
    originalTransactionId,
    latestTransactionId: txn.transactionId,
    environment: txn.environment,
    autoRenew: true,
    currentPeriodStart: startDate,
    currentPeriodEnd: endDate,
    paidPrice: plan.price,
    planSnapshot,
  }

  if (sellerAuth.sellerType === PlanType.PRODUCT_SERVICE) {
    return await prisma.subscription.upsert({
      where: { sellerId: sellerAuth.sellerRecordId },
      create: {
        sellerId: sellerAuth.sellerRecordId,
        ...commonData,
      },
      update: commonData,
      include: { plan: true },
    })
  }

  if (sellerAuth.sellerType === PlanType.HOTEL) {
    return await prisma.hotelSubscription.upsert({
      where: { hotelSellerId: sellerAuth.sellerRecordId },
      create: {
        hotelSellerId: sellerAuth.sellerRecordId,
        ...commonData,
      },
      update: commonData,
      include: { plan: true },
    })
  }

  return await prisma.restaurantSubscription.upsert({
    where: { restaurantSellerId: sellerAuth.sellerRecordId },
    create: {
      restaurantSellerId: sellerAuth.sellerRecordId,
      ...commonData,
    },
    update: commonData,
    include: { plan: true },
  })
}
