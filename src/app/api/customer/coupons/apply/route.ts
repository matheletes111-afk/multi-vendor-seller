import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { validateCoupon } from "@/lib/coupons"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { code, type, subtotal, items } = body

    if (!code || !type || subtotal === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const validationResult = await validateCoupon({
      code,
      type,
      subtotal: parseFloat(subtotal),
      items: items || [],
      userId: session.user.id
    })

    if (!validationResult.valid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        couponId: validationResult.coupon?.id,
        code: validationResult.coupon?.code,
        discountType: validationResult.coupon?.discountType,
        discountValue: validationResult.coupon?.discountValue,
        discountAmount: validationResult.discountAmount
      }
    })
  } catch (error: any) {
    console.error("Error applying coupon:", error)
    return NextResponse.json(
      { error: error.message || "Failed to apply coupon" },
      { status: 500 }
    )
  }
}
