import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getValidSubscription,
  getValidHotelSubscription,
  getValidRestaurantSubscription,
  createPlanSnapshot,
} from "@/lib/subscriptions"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch seller across types
    const [prodSeller, hotelSeller, restSeller] = await Promise.all([
      prisma.seller.findUnique({ where: { userId } }),
      prisma.hotelSeller.findUnique({ where: { userId } }),
      prisma.restaurantSeller.findUnique({ where: { userId } }),
    ])

    let currentSub: any = null
    if (prodSeller) {
      currentSub = await getValidSubscription(prodSeller.id)
    } else if (hotelSeller) {
      currentSub = await getValidHotelSubscription(hotelSeller.id)
    } else if (restSeller) {
      currentSub = await getValidRestaurantSubscription(restSeller.id)
    }

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

    // Construct history list
    const historyList: any[] = []

    if (currentSub) {
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
        planSnapshot: snapshot,
        status: currentSub.status,
        periodStart: currentSub.currentPeriodStart,
        periodEnd: currentSub.currentPeriodEnd,
        createdAt: currentSub.createdAt,
        couponCode: activeUsage?.coupon?.code || null,
        couponDiscount,
        finalPaidAmount: Math.max(0, basePlanPrice - couponDiscount),
        isCurrent: true
      })
    }

    // Add other coupon usages if any
    usages.forEach((usage) => {
      if (currentSub && usage.subscriptionId === currentSub.id) return // Already included above
      historyList.push({
        id: usage.id,
        planName: usage.coupon ? `Seller Coupon (${usage.coupon.code})` : "Subscription Payment",
        planType: "COUPON_REDEMPTION",
        price: usage.coupon ? usage.coupon.discountValue : 0,
        paidPrice: 0,
        planSnapshot: null,
        status: "COMPLETED",
        periodStart: null,
        periodEnd: null,
        createdAt: usage.createdAt,
        couponCode: usage.coupon?.code || null,
        couponDiscount: usage.coupon ? usage.coupon.discountValue : 0,
        finalPaidAmount: 0,
        isCurrent: false
      })
    })

    const snapshot = currentSub ? (currentSub.planSnapshot || createPlanSnapshot(currentSub.plan)) : null
    const currentPlanDetails = (snapshot as any) || currentSub?.plan || null
    const basePlanPrice = currentSub ? (currentSub.paidPrice !== null && currentSub.paidPrice !== undefined ? currentSub.paidPrice : (currentPlanDetails?.price ?? currentSub.plan?.price ?? 0)) : 0

    return NextResponse.json({
      history: historyList,
      currentSubscription: currentSub ? {
        id: currentSub.id,
        status: currentSub.status,
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
