import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { verifySubscriptionPaymentStatus } from "@/lib/subscriptions"

export const dynamic = "force-dynamic"

/**
 * Universal payment verification for all 4 seller types
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const purchaseId = searchParams.get("purchaseId")

    if (!purchaseId) {
      return NextResponse.json({ error: "purchaseId is required" }, { status: 400 })
    }

    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        seller: { select: { userId: true } },
        hotelSeller: { select: { userId: true } },
        restaurantSeller: { select: { userId: true } },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: "Subscription purchase record not found" }, { status: 404 })
    }

    const isOwner =
      purchase.seller?.userId === session.user.id ||
      purchase.hotelSeller?.userId === session.user.id ||
      purchase.restaurantSeller?.userId === session.user.id

    if (!isOwner && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await verifySubscriptionPaymentStatus(purchaseId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[GET /api/seller/subscription/verify-payment] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

