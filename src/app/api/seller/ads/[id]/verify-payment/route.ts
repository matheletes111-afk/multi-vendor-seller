import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { reconcileAdPayment, refreshAdPaymentLink } from "@/lib/ad-payment"
import { normalizeFlotPaymentType } from "@/lib/flot"
import { isAdmin } from "@/lib/rbac"

export const dynamic = "force-dynamic"

/**
 * Check or reconcile live payment status for a specific ad.
 * Also supports refreshing/generating a new payment link.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const ad = await prisma.sellerAd.findUnique({
    where: { id },
    include: {
      seller: { select: { userId: true } },
      hotelSeller: { select: { userId: true } },
      restaurantSeller: { select: { userId: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }

  // Check authorization
  const isOwner =
    ad.customerUserId === session.user.id ||
    ad.seller?.userId === session.user.id ||
    ad.hotelSeller?.userId === session.user.id ||
    ad.restaurantSeller?.userId === session.user.id

  if (!isOwner && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const shouldRefresh = searchParams.get("refresh") === "true"
  let requestedPaymentType =
    searchParams.get("paymentType") ||
    searchParams.get("flotPaymentType") ||
    searchParams.get("type") ||
    undefined

  if (request.method === "POST" && !requestedPaymentType) {
    const body = await request.json().catch(() => ({}))
    requestedPaymentType = body?.paymentType || body?.flotPaymentType || body?.type
  }

  if (shouldRefresh && ad.paymentStatus !== "COMPLETED") {
    const paymentType = normalizeFlotPaymentType(requestedPaymentType, "card")
    const refreshRes = await refreshAdPaymentLink(ad.id, paymentType)
    if (!refreshRes.success) {
      return NextResponse.json({ error: refreshRes.error }, { status: 400 })
    }
    return NextResponse.json({
      success: true,
      paymentStatus: refreshRes.ad?.paymentStatus,
      paymentUrl: refreshRes.paymentUrl,
      paymentCode: refreshRes.paymentCode || null,
      flotCode: refreshRes.paymentCode || null,
      ussdCode: refreshRes.paymentCode || null,
      flotPaymentType: refreshRes.paymentType || paymentType,
      paid: false,
    })
  }

  // Reconcile status with Float
  const result = await reconcileAdPayment({ adId: id })

  return NextResponse.json({
    success: true,
    paymentStatus: result.ad?.paymentStatus,
    paid: result.ad?.paymentStatus === "COMPLETED",
    paymentUrl: result.ad?.flotPaymentLink || null,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Support POST as well for triggering a refresh or check
  return GET(request, { params })
}
