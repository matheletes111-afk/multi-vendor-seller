import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"

import { activateHotelFreePlan } from "@/lib/subscriptions"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isHotelSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { userId: session.user.id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    })

    let subscription = seller?.subscription || null

    if (!subscription && seller) {
      const newSub = await activateHotelFreePlan(seller.id)
      if (newSub) {
        subscription = await prisma.hotelSubscription.findUnique({
          where: { hotelSellerId: seller.id },
          include: { plan: true },
        })
      }
    }

    let appliedCoupon: any = null
    if (subscription) {
      const usage = await prisma.couponUsage.findFirst({
        where: { subscriptionId: subscription.id },
        include: { coupon: true }
      })
      if (usage?.coupon) {
        let discountAmount = 0
        if (usage.coupon.discountType === "PERCENTAGE") {
          discountAmount = (subscription.plan.price * usage.coupon.discountValue) / 100
        } else {
          discountAmount = Math.min(usage.coupon.discountValue, subscription.plan.price)
        }
        appliedCoupon = {
          code: usage.coupon.code,
          discountType: usage.coupon.discountType,
          discountValue: usage.coupon.discountValue,
          discountAmount,
          finalPaidAmount: Math.max(0, subscription.plan.price - discountAmount)
        }
      }
    }

    return NextResponse.json(subscription ? { ...subscription, appliedCoupon } : null)
  } catch (error) {
    console.error("Error fetching hotel subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}
