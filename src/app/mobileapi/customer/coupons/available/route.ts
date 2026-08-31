import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

/**
 * GET /mobileapi/customer/coupons/available
 * Query params:
 *   - type: "PRODUCT" | "SERVICE" | "HOTEL" | "FOOD" (Optional, defaults to all 4 customer types)
 *   - subtotal: number (Optional, for minOrderValue check)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type")?.toUpperCase()
    const subtotalParam = searchParams.get("subtotal")
    const subtotal = subtotalParam ? parseFloat(subtotalParam) : 0

    const now = new Date()

    const allowedTypes = typeParam
      ? [typeParam]
      : ["PRODUCT", "SERVICE", "HOTEL", "FOOD"]

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        type: { in: allowedTypes },
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        type: true,
        minOrderValue: true,
        endDate: true,
        categoryId: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedCoupons = coupons.map((coupon) => {
      const meetsMinOrder = subtotal >= coupon.minOrderValue
      const amountNeededForMinOrder = meetsMinOrder ? 0 : Number((coupon.minOrderValue - subtotal).toFixed(2))

      const discountLabel =
        coupon.discountType === "PERCENTAGE"
          ? `${coupon.discountValue}% OFF`
          : `${formatCurrency(coupon.discountValue)} OFF`

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
        categoryId: coupon.categoryId,
        meetsMinOrder,
        amountNeededForMinOrder,
      }
    })

    return NextResponse.json({
      success: true,
      count: formattedCoupons.length,
      type: typeParam || "ALL_CUSTOMER_TYPES",
      data: formattedCoupons,
    })
  } catch (error: any) {
    console.error("Error fetching mobile available coupons:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch available coupons", data: [] },
      { status: 500 }
    )
  }
}
