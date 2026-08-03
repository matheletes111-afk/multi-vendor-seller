import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { validateSellerCoupon } from "@/lib/coupons"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { code, amount } = body

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 })
    }

    const numAmount = parseFloat(amount) || 0

    const result = await validateSellerCoupon({
      code,
      amount: numAmount,
      userId: session.user.id
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: result.coupon!.id,
        code: result.coupon!.code,
        discountType: result.coupon!.discountType,
        discountValue: result.coupon!.discountValue,
      },
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount
    })
  } catch (error: any) {
    console.error("Seller coupon validation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to validate coupon" },
      { status: 500 }
    )
  }
}
