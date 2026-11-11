import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserAuth } from "./ad-afrimoney"
import { refreshAdPaymentLink, reconcileAdPayment } from "@/lib/ad-payment"
import { UserRole } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * Handle POST request for initiating Float Hosted Checkout for a mobile ad.
 * Universal for all seller types and ad categories.
 */
export async function handleMobileAdFloatPost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await getMobileUserAuth(request)
  if (!authResult.ok || !authResult.user) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: authResult.status || 401 }
    )
  }

  const resolvedParams = await Promise.resolve(context?.params)
  const id = resolvedParams?.id

  if (!id || typeof id !== "string") {
    return NextResponse.json({ success: false, error: "Ad ID is required" }, { status: 400 })
  }

  const user = authResult.user

  const ad = await prisma.sellerAd.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, userId: true } },
      hotelSeller: { select: { id: true, userId: true } },
      restaurantSeller: { select: { id: true, userId: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
  }

  const isOwner =
    ad.customerUserId === user.id ||
    ad.seller?.userId === user.id ||
    ad.hotelSeller?.userId === user.id ||
    ad.restaurantSeller?.userId === user.id

  const isAdminUser = user.role === UserRole.ADMIN

  if (!isOwner && !isAdminUser) {
    return NextResponse.json(
      { success: false, error: "Forbidden: You do not have permission to pay for this ad" },
      { status: 403 }
    )
  }

  if (ad.paymentStatus === "COMPLETED") {
    return NextResponse.json({
      success: true,
      paid: true,
      paymentStatus: "COMPLETED",
      paymentMethod: ad.paymentMethod || "FLOAT",
      flotOrderId: ad.flotOrderId,
      flotPaymentLink: ad.flotPaymentLink,
    })
  }

  // Refresh or generate Float payment link
  const result = await refreshAdPaymentLink(ad.id)

  if (!result.success || !result.paymentUrl) {
    return NextResponse.json(
      { success: false, error: result.error || "Failed to generate Float payment link" },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    paid: false,
    paymentStatus: result.ad?.paymentStatus || "PENDING",
    paymentMethod: "FLOAT",
    paymentUrl: result.paymentUrl,
    flotOrderId: result.ad?.flotOrderId,
    flotPaymentLink: result.paymentUrl,
  })
}

/**
 * Handle GET request for verifying payment status of an ad.
 */
export async function handleMobileAdVerifyPayment(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await getMobileUserAuth(request)
  if (!authResult.ok || !authResult.user) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Unauthorized" },
      { status: authResult.status || 401 }
    )
  }

  const resolvedParams = await Promise.resolve(context?.params)
  const id = resolvedParams?.id

  if (!id || typeof id !== "string") {
    return NextResponse.json({ success: false, error: "Ad ID is required" }, { status: 400 })
  }

  const user = authResult.user

  const ad = await prisma.sellerAd.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, userId: true } },
      hotelSeller: { select: { id: true, userId: true } },
      restaurantSeller: { select: { id: true, userId: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
  }

  const isOwner =
    ad.customerUserId === user.id ||
    ad.seller?.userId === user.id ||
    ad.hotelSeller?.userId === user.id ||
    ad.restaurantSeller?.userId === user.id

  const isAdminUser = user.role === UserRole.ADMIN

  if (!isOwner && !isAdminUser) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  if (ad.paymentStatus === "COMPLETED") {
    return NextResponse.json({
      success: true,
      paid: true,
      paymentStatus: "COMPLETED",
      paymentMethod: ad.paymentMethod,
      flotOrderId: ad.flotOrderId,
      paidAt: ad.paidAt,
    })
  }

  // Actively reconcile Float if Float attempt exists
  if (ad.paymentMethod === "FLOAT" || ad.flotOrderId) {
    const reconcileRes = await reconcileAdPayment({ adId: ad.id })
    const isCompleted = reconcileRes.status === "COMPLETED" || reconcileRes.ad?.paymentStatus === "COMPLETED"
    return NextResponse.json({
      success: reconcileRes.success,
      paid: isCompleted,
      paymentStatus: reconcileRes.ad?.paymentStatus || reconcileRes.status || ad.paymentStatus,
      paymentMethod: reconcileRes.ad?.paymentMethod || ad.paymentMethod,
      flotOrderId: reconcileRes.ad?.flotOrderId || ad.flotOrderId,
      paidAt: reconcileRes.ad?.paidAt || ad.paidAt,
    })
  }

  return NextResponse.json({
    success: true,
    paid: false,
    paymentStatus: ad.paymentStatus,
    paymentMethod: ad.paymentMethod,
    flotOrderId: ad.flotOrderId,
  })
}
