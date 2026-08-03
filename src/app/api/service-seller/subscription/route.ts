import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()

  if (!session?.user || !isSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  })

  const subscription = seller?.subscription || null
  if (!subscription) return NextResponse.json(null)

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
    ...subscription,
    appliedCoupon
  })
}
