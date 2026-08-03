import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const subscription = prodSeller?.subscription || hotelSeller?.subscription || restSeller?.subscription || null

    if (!subscription) {
      return NextResponse.json({ subscription: null })
    }

    const usage = await prisma.couponUsage.findFirst({
      where: { subscriptionId: subscription.id },
      include: { coupon: true }
    })

    let appliedCoupon: any = null
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

    return NextResponse.json({
      subscription: {
        ...subscription,
        appliedCoupon
      }
    })
  } catch (error: any) {
    console.error("Mobile seller get subscription error:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    )
  }
}
