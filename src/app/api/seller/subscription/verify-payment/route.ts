import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { verifySubscriptionPaymentStatus } from "@/lib/subscriptions"
import { getMobileUserAuth } from "@/app/mobileapi/_helpers/ad-afrimoney"

export const dynamic = "force-dynamic"

/**
 * Universal payment verification for all 4 seller types (Web Session + Mobile Bearer JWT)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    let authUserId = session?.user?.id || null
    let isUserAdmin = session?.user ? isAdmin(session.user) : false

    if (!authUserId) {
      const mobileAuth = await getMobileUserAuth(request)
      if (mobileAuth.ok && mobileAuth.user) {
        authUserId = mobileAuth.user.id
        isUserAdmin = mobileAuth.user.role === "ADMIN"
      }
    }

    if (!authUserId) {
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
      purchase.seller?.userId === authUserId ||
      purchase.hotelSeller?.userId === authUserId ||
      purchase.restaurantSeller?.userId === authUserId

    if (!isOwner && !isUserAdmin) {
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

