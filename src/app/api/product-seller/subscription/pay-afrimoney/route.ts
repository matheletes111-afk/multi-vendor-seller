import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { PlanType } from "@prisma/client"
import { initiateAfriMoneySubscriptionPayment } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isProductSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller record not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { planId, phone, couponCode } = body

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const payerMsisdn = (phone || "").toString().trim()
    if (!payerMsisdn) {
      return NextResponse.json(
        { error: "Africell mobile number is required to receive Push USSD" },
        { status: 400 }
      )
    }

    const result = await initiateAfriMoneySubscriptionPayment({
      sellerType: PlanType.PRODUCT_SERVICE,
      sellerId: seller.id,
      planId,
      payerMsisdn,
      couponCode,
      userId: session.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message, ...result },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /api/product-seller/subscription/pay-afrimoney] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

