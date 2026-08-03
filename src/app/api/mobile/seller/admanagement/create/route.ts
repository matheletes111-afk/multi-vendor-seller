import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const body = await request.json().catch(() => ({}))
    const {
      title,
      description,
      totalBudget,
      maxCpc,
      placements,
      creativeType,
      creativeUrl,
      mobileCreativeType,
      mobileCreativeUrl,
      startAt,
      endAt,
      couponCode,
      sellerType,
      productId,
      serviceId,
      hotelId,
      foodItemId,
      userId: bodyUserId
    } = body

    const userId = session?.user?.id || bodyUserId

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized / Seller User ID required" }, { status: 401 })
    }

    if (!title || !totalBudget || !maxCpc || !startAt || !endAt) {
      return NextResponse.json({ error: "Title, totalBudget, maxCpc, startAt, and endAt are required" }, { status: 400 })
    }

    const numBudget = parseFloat(totalBudget) || 0
    const numMaxCpc = parseFloat(maxCpc) || 0

    if (numBudget <= 0) return NextResponse.json({ error: "Total budget must be greater than 0" }, { status: 400 })
    if (numMaxCpc > numBudget) return NextResponse.json({ error: "Max CPC cannot exceed total budget" }, { status: 400 })

    // Validate Coupon if provided
    let discountAmount = 0
    let validatedCoupon: any = null

    if (couponCode) {
      const val = await validateSellerCoupon({
        code: couponCode,
        amount: numBudget,
        userId
      })
      if (!val.valid) {
        return NextResponse.json({ error: val.error }, { status: 400 })
      }
      discountAmount = val.discountAmount || 0
      validatedCoupon = val.coupon
    }

    // Resolve seller ID based on seller type
    let sellerId: string | null = null
    let hotelSellerId: string | null = null
    let restaurantSellerId: string | null = null

    const [prodSeller, hotelS, restS] = await Promise.all([
      prisma.seller.findUnique({ where: { userId } }),
      prisma.hotelSeller.findUnique({ where: { userId } }),
      prisma.restaurantSeller.findUnique({ where: { userId } }),
    ])

    if (prodSeller) sellerId = prodSeller.id
    if (hotelS) hotelSellerId = hotelS.id
    if (restS) restaurantSellerId = restS.id

    const createdAd = await prisma.sellerAd.create({
      data: {
        sellerId,
        hotelSellerId,
        restaurantSellerId,
        productId: productId || null,
        serviceId: serviceId || null,
        hotelId: hotelId || null,
        foodItemId: foodItemId || null,
        title,
        description: description || null,
        placements: Array.isArray(placements) ? placements : ["MOBILE"],
        creativeType: creativeType || "IMAGE",
        creativeUrl: creativeUrl || mobileCreativeUrl || "",
        mobileCreativeType: mobileCreativeType || "IMAGE",
        mobileCreativeUrl: mobileCreativeUrl || creativeUrl || null,
        status: "PENDING_APPROVAL",
        totalBudget: numBudget,
        spentAmount: 0,
        maxCpc: numMaxCpc,
        startAt: new Date(startAt),
        endAt: new Date(endAt)
      }
    })

    // Record Coupon Usage if applied
    if (validatedCoupon && createdAd) {
      await recordSellerCouponUsage({
        couponId: validatedCoupon.id,
        userId,
        sellerAdId: createdAd.id
      })
    }

    return NextResponse.json({
      success: true,
      adId: createdAd.id,
      totalBudget: numBudget,
      discountAmount,
      finalPaidBudget: Math.max(0, numBudget - discountAmount),
      couponCode: validatedCoupon?.code || null
    })
  } catch (error: any) {
    console.error("Mobile ad creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create ad campaign" },
      { status: 500 }
    )
  }
}
