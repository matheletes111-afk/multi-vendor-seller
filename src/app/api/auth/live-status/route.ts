import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const internalSecret = request.headers.get("x-internal-secret")
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    const validSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "internal-secret"

    let targetUserId: string | null = null
    let targetRole: string | null = null

    // 1. If called internally (e.g. from middleware) with the secret
    if (internalSecret && (internalSecret === validSecret || internalSecret === "internal-secret")) {
      targetUserId = searchParams.get("userId")
      targetRole = searchParams.get("role")
    } else if (authHeader?.startsWith("Bearer ")) {
      // 2. If called from mobile app with Bearer token
      const token = authHeader.slice(7).trim()
      const payload = verifyMobileAccessToken(token)
      if (!payload?.userId || !payload?.role) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
      }
      targetUserId = payload.userId
      targetRole = payload.role
    } else {
      // 3. Called from client web browser with NextAuth session cookie
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      targetUserId = session.user.id
      targetRole = session.user.role
    }

    if (!targetUserId || !targetRole) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 })
    }

    let isApproved = false
    let isSuspended = false
    let status = "PENDING"
    let onboardingCompleted = false
    let adminFeedback: string | null = null

    if (
      targetRole === UserRole.SELLER_PRODUCT ||
      targetRole === UserRole.SELLER_SERVICE
    ) {
      const seller = await prisma.seller.findUnique({
        where: { userId: targetUserId },
        select: {
          id: true,
          isApproved: true,
          isSuspended: true,
          status: true,
          onboardingCompleted: true,
          adminFeedback: true,
        },
      })
      if (!seller) {
        return NextResponse.json({ error: "Seller profile not found" }, { status: 404 })
      }
      isApproved = Boolean(seller.isApproved)
      isSuspended = Boolean(seller.isSuspended)
      status = seller.status || (seller.isApproved ? "APPROVED" : "PENDING")
      onboardingCompleted = Boolean(seller.onboardingCompleted)
      adminFeedback = seller.adminFeedback ?? null
    } else if (targetRole === UserRole.SELLER_HOTEL) {
      const seller = await prisma.hotelSeller.findUnique({
        where: { userId: targetUserId },
        select: {
          id: true,
          isApproved: true,
          isSuspended: true,
          status: true,
          onboardingCompleted: true,
          adminFeedback: true,
        },
      })
      if (!seller) {
        return NextResponse.json({ error: "Hotel seller profile not found" }, { status: 404 })
      }
      isApproved = Boolean(seller.isApproved)
      isSuspended = Boolean(seller.isSuspended)
      status = seller.status || (seller.isApproved ? "APPROVED" : "PENDING")
      onboardingCompleted = Boolean(seller.onboardingCompleted)
      adminFeedback = seller.adminFeedback ?? null
    } else if (targetRole === UserRole.SELLER_RESTAURANT) {
      const seller = await prisma.restaurantSeller.findUnique({
        where: { userId: targetUserId },
        select: {
          id: true,
          isApproved: true,
          isSuspended: true,
          status: true,
          onboardingCompleted: true,
          adminFeedback: true,
        },
      })
      if (!seller) {
        return NextResponse.json({ error: "Restaurant seller profile not found" }, { status: 404 })
      }
      isApproved = Boolean(seller.isApproved)
      isSuspended = Boolean(seller.isSuspended)
      status = seller.status || (seller.isApproved ? "APPROVED" : "PENDING")
      onboardingCompleted = Boolean(seller.onboardingCompleted)
      adminFeedback = seller.adminFeedback ?? null
    } else if (targetRole === UserRole.RIDER) {
      const rider = await prisma.rider.findUnique({
        where: { userId: targetUserId },
        select: {
          id: true,
          isApproved: true,
          isSuspended: true,
          status: true,
          onboardingCompleted: true,
          adminFeedback: true,
        },
      })
      if (!rider) {
        return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
      }
      isApproved = Boolean(rider.isApproved)
      isSuspended = Boolean(rider.isSuspended || rider.status === "SUSPENDED")
      status = rider.status || (rider.isApproved ? "APPROVED" : "PENDING")
      onboardingCompleted = Boolean(rider.onboardingCompleted)
      adminFeedback = rider.adminFeedback ?? null
    } else {
      return NextResponse.json({ error: "Unsupported role for live status" }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        userId: targetUserId,
        role: targetRole,
        isApproved,
        isSuspended,
        status,
        onboardingCompleted,
        adminFeedback,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("[API] live-status error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
