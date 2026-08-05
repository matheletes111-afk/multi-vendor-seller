import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET /api/customer/coupons — Fetch active public coupons for a specific type (PRODUCT, SERVICE, HOTEL, FOOD). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type")?.toUpperCase()

    const now = new Date()

    const allowedTypes = typeParam
      ? [typeParam]
      : ["PRODUCT", "SERVICE", "HOTEL", "FOOD", "SELLER"]

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

    return NextResponse.json(coupons)
  } catch (error) {
    console.error("Error fetching available coupons:", error)
    return NextResponse.json([], { status: 500 })
  }
}
