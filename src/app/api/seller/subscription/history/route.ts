import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch seller subscription across types
    const [prodSeller, hotelSeller, restSeller] = await Promise.all([
      prisma.seller.findUnique({
        where: { userId },
        include: { subscription: { include: { plan: true } } }
      }),
      prisma.hotelSeller.findUnique({
        where: { userId },
        include: { subscription: { include: { plan: true } } }
      }),
      prisma.restaurantSeller.findUnique({
        where: { userId },
        include: { subscription: { include: { plan: true } } }
      })
    ])

    const currentSub = prodSeller?.subscription || hotelSeller?.subscription || restSeller?.subscription || null

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
      let couponDiscount = 0
      if (activeUsage?.coupon) {
        if (activeUsage.coupon.discountType === "PERCENTAGE") {
          couponDiscount = (currentSub.plan.price * activeUsage.coupon.discountValue) / 100
        } else {
          couponDiscount = Math.min(activeUsage.coupon.discountValue, currentSub.plan.price)
        }
      }

      historyList.push({
        id: currentSub.id,
        planName: currentSub.plan.displayName,
        planType: currentSub.plan.name,
        price: currentSub.plan.price,
        status: currentSub.status,
        periodStart: currentSub.currentPeriodStart,
        periodEnd: currentSub.currentPeriodEnd,
        createdAt: currentSub.createdAt,
        couponCode: activeUsage?.coupon?.code || null,
        couponDiscount,
        finalPaidAmount: Math.max(0, currentSub.plan.price - couponDiscount),
        isCurrent: true
      })
    }

    // Add other usages if any
    usages.forEach((usage) => {
      if (currentSub && usage.subscriptionId === currentSub.id) return // Already included above
      historyList.push({
        id: usage.id,
        planName: usage.coupon ? `Seller Coupon (${usage.coupon.code})` : "Subscription Payment",
        planType: "COUPON_REDEMPTION",
        price: usage.coupon ? usage.coupon.discountValue : 0,
        status: "COMPLETED",
        createdAt: usage.createdAt,
        couponCode: usage.coupon?.code || null,
        couponDiscount: usage.coupon ? usage.coupon.discountValue : 0,
        finalPaidAmount: 0,
        isCurrent: false
      })
    })

    return NextResponse.json({
      history: historyList,
      currentSubscription: currentSub
    })
  } catch (error: any) {
    console.error("Error fetching seller subscription history:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription history" },
      { status: 500 }
    )
  }
}
