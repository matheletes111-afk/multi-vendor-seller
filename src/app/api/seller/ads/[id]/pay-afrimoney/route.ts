import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { initiateAfriMoneyAdPayment } from "@/lib/ad-payment"

export const dynamic = "force-dynamic"

/**
 * Initiate an AfriMoney Push USSD payment for a specific ad.
 * Universal for Product, Hotel, Restaurant, Service, and Customer Ads.
 */
export async function POST(
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

  const isOwner =
    ad.customerUserId === session.user.id ||
    ad.seller?.userId === session.user.id ||
    ad.hotelSeller?.userId === session.user.id ||
    ad.restaurantSeller?.userId === session.user.id

  if (!isOwner && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const phone = (body.phone || body.msisdn || "").toString().trim()

  if (!phone) {
    return NextResponse.json(
      { error: "Phone number (Africell MSISDN) is required to receive Push USSD" },
      { status: 400 }
    )
  }

  const result = await initiateAfriMoneyAdPayment({
    adId: id,
    payerMsisdn: phone,
    userId: session.user.id,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || result.message },
      { status: 400 }
    )
  }

  return NextResponse.json(result)
}

/**
 * Check payment status of the ad
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
    select: {
      id: true,
      title: true,
      paymentStatus: true,
      paymentMethod: true,
      payableAmount: true,
      totalBudget: true,
      paidAt: true,
    },
  })

  if (!ad) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    paid: ad.paymentStatus === "COMPLETED",
    title: ad.title,
    paymentStatus: ad.paymentStatus,
    paymentMethod: ad.paymentMethod,
    payableAmount: ad.payableAmount ?? ad.totalBudget,
    totalBudget: ad.totalBudget,
    paidAt: ad.paidAt,
  })
}
