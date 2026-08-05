import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /mobileapi/seller/coupons/available
 * Query params:
 *   - amount: number (Optional, subtotal/plan/budget amount for minOrderValue check)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const amountParam = searchParams.get("amount")
    const amount = amountParam ? parseFloat(amountParam) : 0

    const now = new Date()

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        type: "SELLER",
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        type: true,
        minOrderValue: true,
        endDate: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedCoupons = coupons.map((coupon) => {
      const meetsMinOrder = amount >= coupon.minOrderValue
      const amountNeededForMinOrder = meetsMinOrder ? 0 : Number((coupon.minOrderValue - amount).toFixed(2))

      const discountLabel =
        coupon.discountType === "PERCENTAGE"
          ? `${coupon.discountValue}% OFF`
          : `NLe ${coupon.discountValue.toFixed(2)} OFF`

      const expiryFormatted = new Date(coupon.endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })

      return {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountLabel,
        type: coupon.type,
        minOrderValue: coupon.minOrderValue,
        endDate: coupon.endDate,
        expiryFormatted,
        meetsMinOrder,
        amountNeededForMinOrder,
      }
    })

    return NextResponse.json({
      success: true,
      count: formattedCoupons.length,
      type: "SELLER",
      data: formattedCoupons,
    })
  } catch (error: any) {
    console.error("Error fetching mobile available seller coupons:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch available seller coupons", data: [] },
      { status: 500 }
    )
  }
}
