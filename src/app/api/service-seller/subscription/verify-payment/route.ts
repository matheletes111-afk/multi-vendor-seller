import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSeller, isAdmin } from "@/lib/rbac"
import { verifySubscriptionPaymentStatus } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (!isSeller(session.user) && !isAdmin(session.user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const purchaseId = searchParams.get("purchaseId")

    if (!purchaseId) {
      return NextResponse.json({ error: "purchaseId is required" }, { status: 400 })
    }

    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId },
      include: { seller: true },
    })

    if (!purchase) {
      return NextResponse.json({ error: "Subscription purchase record not found" }, { status: 404 })
    }

    if (!isAdmin(session.user) && purchase.seller?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await verifySubscriptionPaymentStatus(purchaseId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[GET /api/service-seller/subscription/verify-payment] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

