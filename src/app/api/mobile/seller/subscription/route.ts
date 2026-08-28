import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getValidSubscription,
  getValidHotelSubscription,
  getValidRestaurantSubscription,
} from "@/lib/subscriptions"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const paramUserId = searchParams.get("userId")

    const userId = session?.user?.id || paramUserId

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized / Seller User ID required" }, { status: 401 })
    }

    const [prodSeller, hotelSeller, restSeller] = await Promise.all([
      prisma.seller.findUnique({ where: { userId } }),
      prisma.hotelSeller.findUnique({ where: { userId } }),
      prisma.restaurantSeller.findUnique({ where: { userId } }),
    ])

    let subscription: any = null

    if (prodSeller) {
      subscription = await getValidSubscription(prodSeller.id)
    } else if (hotelSeller) {
      subscription = await getValidHotelSubscription(hotelSeller.id)
    } else if (restSeller) {
      subscription = await getValidRestaurantSubscription(restSeller.id)
    }

    if (!subscription) {
      return NextResponse.json({ subscription: null })
    }

    const usage = await prisma.couponUsage.findFirst({
      where: { subscriptionId: subscription.id },
      include: { coupon: true },
    })

    let appliedCoupon: any = null
    if (usage?.coupon) {
      const planPrice = subscription.plan?.price ?? 0
      let discountAmount = 0
      if (usage.coupon.discountType === "PERCENTAGE") {
        discountAmount = (planPrice * usage.coupon.discountValue) / 100
      } else {
        discountAmount = Math.min(usage.coupon.discountValue, planPrice)
      }
      appliedCoupon = {
        code: usage.coupon.code,
        discountType: usage.coupon.discountType,
        discountValue: usage.coupon.discountValue,
        discountAmount,
        finalPaidAmount: Math.max(0, planPrice - discountAmount),
      }
    }

    return NextResponse.json({
      subscription: {
        ...subscription,
        appliedCoupon,
      },
    })
  } catch (error: any) {
    console.error("Mobile seller get subscription error:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    )
  }
}
