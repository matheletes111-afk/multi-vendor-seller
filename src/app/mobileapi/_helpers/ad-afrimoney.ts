import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { UserRole } from "@prisma/client"
import { initiateAfriMoneyAdPayment } from "@/lib/ad-payment"

export const dynamic = "force-dynamic"

export interface MobileUserAuthResult {
  ok: boolean
  user?: {
    id: string
    role: UserRole
  }
  status?: number
  error?: string
}

/**
 * Verifies mobile Bearer token and checks user status in the database.
 * Supports any role: Product Seller, Service Seller, Hotel Seller, Restaurant Seller, Customer, or Admin.
 */
export async function getMobileUserAuth(request: NextRequest): Promise<MobileUserAuthResult> {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized: Missing or invalid Authorization header" }
  }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)

  if (!payload || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, status: 401, error: "Unauthorized: Invalid or expired token" }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, password: true },
    })

    if (!dbUser) {
      return { ok: false, status: 401, error: "Unauthorized: User not found" }
    }

    // Password revocation / token hash validation
    const tokenHasPassword = payload.passwordHash != null
    const dbHasPassword = dbUser.password != null
    if (
      (tokenHasPassword && dbUser.password !== payload.passwordHash) ||
      (dbHasPassword && dbUser.password !== payload.passwordHash)
    ) {
      return { ok: false, status: 401, error: "Unauthorized: Session invalidated due to password change" }
    }

    return {
      ok: true,
      user: {
        id: dbUser.id,
        role: dbUser.role as UserRole,
      },
    }
  } catch (error) {
    console.error("[Mobile Ad AfriMoney] Auth verification error:", error)
    return { ok: false, status: 500, error: "Authentication service error" }
  }
}

/**
 * Handle POST request for initiating AfriMoney Push USSD for an ad.
 * Universal for all seller types and ad categories.
 */
export async function handleMobileAdAfrimoneyPost(
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

  // Fetch ad with ownership relationships for strict IDOR check
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

  // Strict ownership verification: Zero IDOR
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

  // Idempotency: If already paid, return early with COMPLETED status
  if (ad.paymentStatus === "COMPLETED") {
    return NextResponse.json({
      success: true,
      paid: true,
      payableAmount: 0,
      paymentStatus: "COMPLETED",
      message: "Ad is already paid",
      data: {
        adId: ad.id,
        paid: true,
        payableAmount: 0,
        paymentStatus: "COMPLETED",
        paymentMethod: ad.paymentMethod || "AFRIMONEY",
        afriTxnId: ad.afriTxnId,
        afriFtxnId: ad.afriFtxnId,
      },
    })
  }

  // Parse and validate phone number payload
  const body = await request.json().catch(() => ({}))
  const rawPhone = (body?.phone ?? body?.msisdn ?? "").toString().trim()

  if (!rawPhone) {
    return NextResponse.json(
      { success: false, error: "Phone number (Africell MSISDN) is required to receive Push USSD" },
      { status: 400 }
    )
  }

  const cleanDigits = rawPhone.replace(/\D/g, "")
  if (cleanDigits.length < 8 || cleanDigits.length > 15) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid phone number format. Please provide a valid Africell number (e.g. 080612072 or 033600171)",
      },
      { status: 400 }
    )
  }

  // Falsy vs Valid Zero check (Pillar 1)
  const payableAmount = ad.payableAmount != null ? Number(ad.payableAmount) : Number(ad.totalBudget)

  if (payableAmount <= 0) {
    await prisma.sellerAd.update({
      where: { id: ad.id },
      data: {
        paymentStatus: "COMPLETED",
        paymentMethod: "AFRIMONEY",
        payableAmount: 0,
        paidAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      paid: true,
      payableAmount: 0,
      paymentStatus: "COMPLETED",
      message: "Ad budget is zero, marked completed.",
      data: {
        adId: ad.id,
        paid: true,
        payableAmount: 0,
        paymentStatus: "COMPLETED",
      },
    })
  }

  // Initiate Push USSD via core payment service
  const result = await initiateAfriMoneyAdPayment({
    adId: ad.id,
    payerMsisdn: rawPhone,
    userId: user.id,
  })

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || result.message || "Failed to initiate AfriMoney Push USSD",
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    paid: result.paymentStatus === "COMPLETED",
    txnId: result.txnId,
    payableAmount: result.payableAmount,
    paymentStatus: result.paymentStatus,
    message: result.message,
    data: {
      adId: ad.id,
      txnId: result.txnId,
      payableAmount: result.payableAmount,
      paymentStatus: result.paymentStatus,
      externalReferenceId: `AD_${ad.id}`,
      payerMsisdn: rawPhone,
    },
  })
}

/**
 * Handle GET request for checking payment status of an ad.
 * Provides 100% parity with web response structure and polling compatibility.
 */
export async function handleMobileAdAfrimoneyGet(
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
    select: {
      id: true,
      title: true,
      customerUserId: true,
      paymentStatus: true,
      paymentMethod: true,
      payableAmount: true,
      totalBudget: true,
      paidAt: true,
      afriTxnId: true,
      afriFtxnId: true,
      afriMsisdn: true,
      status: true,
      seller: { select: { userId: true } },
      hotelSeller: { select: { userId: true } },
      restaurantSeller: { select: { userId: true } },
    },
  })

  if (!ad) {
    return NextResponse.json({ success: false, error: "Ad not found" }, { status: 404 })
  }

  // Strict ownership check: Zero IDOR
  const isOwner =
    ad.customerUserId === user.id ||
    ad.seller?.userId === user.id ||
    ad.hotelSeller?.userId === user.id ||
    ad.restaurantSeller?.userId === user.id

  const isAdminUser = user.role === UserRole.ADMIN

  if (!isOwner && !isAdminUser) {
    return NextResponse.json(
      { success: false, error: "Forbidden: You do not have permission to view this ad's payment status" },
      { status: 403 }
    )
  }

  const isPaid = ad.paymentStatus === "COMPLETED"
  const payableAmount = ad.payableAmount != null ? Number(ad.payableAmount) : Number(ad.totalBudget)
  const totalBudget = Number(ad.totalBudget)

  return NextResponse.json({
    success: true,
    paid: isPaid,
    title: ad.title,
    paymentStatus: ad.paymentStatus,
    paymentMethod: ad.paymentMethod,
    payableAmount,
    totalBudget,
    paidAt: ad.paidAt ? ad.paidAt.toISOString() : null,
    afriTxnId: ad.afriTxnId,
    afriFtxnId: ad.afriFtxnId,
    afriMsisdn: ad.afriMsisdn,
    status: ad.status,
    data: {
      id: ad.id,
      title: ad.title,
      paid: isPaid,
      paymentStatus: ad.paymentStatus,
      paymentMethod: ad.paymentMethod,
      payableAmount,
      totalBudget,
      paidAt: ad.paidAt ? ad.paidAt.toISOString() : null,
      afriTxnId: ad.afriTxnId,
      afriFtxnId: ad.afriFtxnId,
      afriMsisdn: ad.afriMsisdn,
      status: ad.status,
    },
  })
}
