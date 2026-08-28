import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"
import { getValidSubscription, activateFreePlan } from "@/lib/subscriptions"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) return NextResponse.json(null)

  let subscription = await getValidSubscription(seller.id)
  if (!subscription) {
    await activateFreePlan(seller.id)
    subscription = await getValidSubscription(seller.id)
  }

  if (!subscription) return NextResponse.json(null)

  const usage = await prisma.couponUsage.findFirst({
    where: { subscriptionId: subscription.id },
    include: { coupon: true }
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
      finalPaidAmount: Math.max(0, planPrice - discountAmount)
    }
  }

  return NextResponse.json({
    ...subscription,
    appliedCoupon
  })
}
