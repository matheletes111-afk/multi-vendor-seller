import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getValidSubscription,
  getValidHotelSubscription,
  getValidRestaurantSubscription,
  createPlanSnapshot,
} from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"
import { getMobileUserAuth } from "@/app/mobileapi/_helpers/ad-afrimoney"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    let userId = session?.user?.id || null
    if (!userId) {
      const mobileAuth = await getMobileUserAuth(request)
      if (mobileAuth.ok && mobileAuth.user) {
        userId = mobileAuth.user.id
      }
    }
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch seller across types
    const [prodSeller, hotelSeller, restSeller] = await Promise.all([
      prisma.seller.findUnique({ where: { userId } }),
      prisma.hotelSeller.findUnique({ where: { userId } }),
      prisma.restaurantSeller.findUnique({ where: { userId } }),
    ])

    let currentSub: any = null
    let sellerId: string | null = null
    let sellerType: PlanType = PlanType.PRODUCT_SERVICE

    if (prodSeller) {
      sellerId = prodSeller.id
      sellerType = PlanType.PRODUCT_SERVICE
      currentSub = await getValidSubscription(prodSeller.id)
    } else if (hotelSeller) {
      sellerId = hotelSeller.id
      sellerType = PlanType.HOTEL
      currentSub = await getValidHotelSubscription(hotelSeller.id)
    } else if (restSeller) {
      sellerId = restSeller.id
      sellerType = PlanType.RESTAURANT
      currentSub = await getValidRestaurantSubscription(restSeller.id)
    }

    // Fetch purchases from SubscriptionPurchase universal ledger
    const purchases = sellerId ? await prisma.subscriptionPurchase.findMany({
      where: {
        sellerType,
        ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId } : {}),
        ...(sellerType === PlanType.HOTEL ? { hotelSellerId: sellerId } : {}),
        ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: sellerId } : {}),
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }) : []

    const queuedPacks = purchases.filter((p) => p.status === "QUEUED")

    // Fetch all subscription coupon redemptions for this seller
    const usages = await prisma.couponUsage.findMany({
      where: {
        userId,
        OR: [
          { subscriptionId: { not: null } },
          { coupon: { type: "SELLER" } }
        ]
      },
      include: { coupon: true },
      orderBy: { createdAt: "desc" }
    })

    const historyList: any[] = []

    if (purchases.length > 0) {
      purchases.forEach((p) => {
        const snapshot = (p.planSnapshot as any) || createPlanSnapshot(p.plan)
        const isCurrent = p.status === "ACTIVE"
        historyList.push({
          id: p.id,
          planName: snapshot?.displayName || p.plan?.displayName || p.plan?.name,
          planType: p.plan?.name,
          price: p.price,
          paidPrice: p.paidPrice,
          paidAt: p.paidAt,
          planSnapshot: snapshot,
          status: p.status,
          provider: p.paymentMethod?.toLowerCase() || (p.flotOrderId ? "float" : "afrimoney"),
          paymentMethod: p.paymentMethod,
          afriTxnId: p.afriTxnId || null,
          afriFtxnId: p.afriFtxnId || null,
          afriMsisdn: p.afriMsisdn || null,
          flotOrderId: p.flotOrderId || null,
          flotPaymentLink: null,
          originalTransactionId: null,
          latestTransactionId: null,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          createdAt: p.createdAt,
          couponCode: p.couponCode || null,
          couponDiscount: p.discountAmount,
          finalPaidAmount: p.paidPrice,
          isCurrent,
        })
      })
    } else if (currentSub) {
      const activeUsage = usages.find(u => u.subscriptionId === currentSub.id)
      const snapshot = currentSub.planSnapshot || createPlanSnapshot(currentSub.plan)
      const planDetails = (snapshot as any) || currentSub.plan
      const basePlanPrice = currentSub.paidPrice !== null && currentSub.paidPrice !== undefined
        ? currentSub.paidPrice
        : (planDetails?.price ?? currentSub.plan?.price ?? 0)
      let couponDiscount = 0
      if (activeUsage?.coupon) {
        if (activeUsage.coupon.discountType === "PERCENTAGE") {
          couponDiscount = (basePlanPrice * activeUsage.coupon.discountValue) / 100
        } else {
          couponDiscount = Math.min(activeUsage.coupon.discountValue, basePlanPrice)
        }
      }

      historyList.push({
        id: currentSub.id,
        planName: planDetails?.displayName || currentSub.plan.displayName,
        planType: planDetails?.name || currentSub.plan.name,
        price: basePlanPrice,
        paidPrice: currentSub.paidPrice ?? null,
        paidAt: currentSub.paidAt ?? null,
        planSnapshot: snapshot,
        status: currentSub.status,
        provider: currentSub.provider || "stripe",
        paymentMethod: currentSub.paymentMethod || (currentSub.provider ? currentSub.provider.toUpperCase() : null),
        afriTxnId: currentSub.afriTxnId || null,
        afriFtxnId: currentSub.afriFtxnId || null,
        afriMsisdn: currentSub.afriMsisdn || null,
        flotOrderId: currentSub.flotOrderId || null,
        flotPaymentLink: currentSub.flotPaymentLink || null,
        originalTransactionId: currentSub.originalTransactionId || null,
        latestTransactionId: currentSub.latestTransactionId || null,
        periodStart: currentSub.currentPeriodStart,
        periodEnd: currentSub.currentPeriodEnd,
        createdAt: currentSub.createdAt,
        couponCode: activeUsage?.coupon?.code || null,
        couponDiscount,
        finalPaidAmount: Math.max(0, basePlanPrice - couponDiscount),
        isCurrent: true
      })
    }

    const snapshot = currentSub ? (currentSub.planSnapshot || createPlanSnapshot(currentSub.plan)) : null
    const currentPlanDetails = (snapshot as any) || currentSub?.plan || null
    const basePlanPrice = currentSub ? (currentSub.paidPrice !== null && currentSub.paidPrice !== undefined ? currentSub.paidPrice : (currentPlanDetails?.price ?? currentSub.plan?.price ?? 0)) : 0

    return NextResponse.json({
      history: historyList,
      queuedPacks: queuedPacks.map((q) => ({
        id: q.id,
        planName: q.plan?.displayName || q.plan?.name,
        status: q.status,
        periodStart: q.periodStart,
        periodEnd: q.periodEnd,
        durationDays: q.durationDays,
        price: q.price,
        paidPrice: q.paidPrice,
        couponCode: q.couponCode || null,
        couponDiscount: q.discountAmount || 0,
        paymentMethod: q.paymentMethod,
        afriTxnId: q.afriTxnId,
        flotOrderId: q.flotOrderId ?? null,
        paidAt: q.paidAt,
      })),
      currentSubscription: currentSub ? {
        id: currentSub.id,
        status: currentSub.status,
        provider: currentSub.provider || "stripe",
        paymentMethod: currentSub.paymentMethod || (currentSub.provider ? currentSub.provider.toUpperCase() : null),
        afriTxnId: currentSub.afriTxnId || null,
        afriFtxnId: currentSub.afriFtxnId || null,
        afriMsisdn: currentSub.afriMsisdn || null,
        flotOrderId: currentSub.flotOrderId || null,
        flotPaymentLink: currentSub.flotPaymentLink || null,
        paidAt: currentSub.paidAt || null,
        originalTransactionId: currentSub.originalTransactionId || null,
        latestTransactionId: currentSub.latestTransactionId || null,
        planName: currentPlanDetails?.displayName || currentSub.plan.displayName,
        price: basePlanPrice,
        paidPrice: currentSub.paidPrice ?? null,
        planSnapshot: snapshot,
        currentPeriodStart: currentSub.currentPeriodStart,
        currentPeriodEnd: currentSub.currentPeriodEnd,
        createdAt: currentSub.createdAt,
      } : null
    })
  } catch (error: any) {
    console.error("Error fetching seller subscription history:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription history" },
      { status: 500 }
    )
  }
}
