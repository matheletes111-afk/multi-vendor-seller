import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"
import { UserRole, PlanType } from "@prisma/client"
import { initiateAfriMoneySubscriptionPayment } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 })
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: auth.userId },
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
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
      userId: auth.userId,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || result.message, ...result },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /mobileapi/service-seller/subscription/pay-afrimoney] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

