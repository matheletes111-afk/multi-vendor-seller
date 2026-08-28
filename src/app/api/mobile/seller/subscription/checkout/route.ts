import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"
import { createPlanSnapshot } from "@/lib/subscriptions"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json().catch(() => ({}))
    const { planId, couponCode, sellerType, userId: bodyUserId } = body

    const userId = session?.user?.id || bodyUserId

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized / Seller User ID required" }, { status: 401 })
    }

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const type = sellerType || plan.type // "PRODUCT_SERVICE", "HOTEL", "RESTAURANT"

    // Validate Coupon if provided
    let discountAmount = 0
    let validatedCoupon: any = null

    if (couponCode) {
      const val = await validateSellerCoupon({
        code: couponCode,
        amount: plan.price,
        userId
      })
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 })
      }
      discountAmount = val.discountAmount || 0
      validatedCoupon = val.coupon
    }

    const finalAmount = Math.max(0, plan.price - discountAmount)
    const now = new Date()
    const periodEnd = new Date(now.getTime() + (plan.duration || 30) * 24 * 60 * 60 * 1000)
    const snapshot = createPlanSnapshot(plan)

    let createdSubId = ""

    if (type === "HOTEL") {
      const hotelSeller = await prisma.hotelSeller.findUnique({ where: { userId } })
      if (!hotelSeller) return NextResponse.json({ error: "Hotel seller not found" }, { status: 404 })

      const sub = await prisma.hotelSubscription.upsert({
        where: { hotelSellerId: hotelSeller.id },
        create: {
          hotelSellerId: hotelSeller.id,
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
      createdSubId = sub.id
    } else if (type === "RESTAURANT") {
      const restSeller = await prisma.restaurantSeller.findUnique({ where: { userId } })
      if (!restSeller) return NextResponse.json({ error: "Restaurant seller not found" }, { status: 404 })

      const sub = await prisma.restaurantSubscription.upsert({
        where: { restaurantSellerId: restSeller.id },
        create: {
          restaurantSellerId: restSeller.id,
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
      createdSubId = sub.id
    } else {
      const seller = await prisma.seller.findUnique({ where: { userId } })
      if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

      const sub = await prisma.subscription.upsert({
        where: { sellerId: seller.id },
        create: {
          sellerId: seller.id,
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: plan.id,
          paidPrice: finalAmount, // Store actual paid amount (after coupon discount)
          planSnapshot: snapshot,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
      createdSubId = sub.id
    }

    // Record Coupon Usage if coupon applied
    if (validatedCoupon && createdSubId) {
      await recordSellerCouponUsage({
        couponId: validatedCoupon.id,
        userId,
        subscriptionId: createdSubId
      })
    }

    return NextResponse.json({
      success: true,
      message: "Subscription activated successfully",
      subscriptionId: createdSubId,
      paidAmount: finalAmount,
      discountAmount,
      couponCode: validatedCoupon?.code || null
    })
  } catch (error: any) {
    console.error("Mobile subscription checkout error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process mobile subscription checkout" },
      { status: 500 }
    )
  }
}
