import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export interface LiveStatusData {
  userId: string
  role: string
  isApproved: boolean
  isSuspended: boolean
  status: string
  onboardingCompleted: boolean
  adminFeedback: string | null
}

/**
 * Common handler for mobile live status checks.
 * Verifies Bearer token, enforces role if specified, and queries the database directly with no caching.
 */
export async function getLiveStatusResponse(
  request: NextRequest,
  expectedRole?: UserRole
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid Authorization header. Expected 'Bearer <accessToken>'",
        },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7).trim()
    const payload = verifyMobileAccessToken(token)

    if (!payload?.userId || !payload?.role) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired access token." },
        { status: 401 }
      )
    }

    const targetUserId = payload.userId
    const targetRole = payload.role as UserRole

    // If an explicit role is expected for this route (e.g. /product-seller route expects SELLER_PRODUCT)
    if (expectedRole && targetRole !== expectedRole) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Token role '${targetRole}' does not match expected role '${expectedRole}'.`,
        },
        { status: 403 }
      )
    }

    // Same session-invalidation rule as getMobileSellerAuth: a token issued before a
    // password change must no longer be accepted.
    const dbUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { password: true },
    })
    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired access token." },
        { status: 401 }
      )
    }
    const tokenHasPassword = payload.passwordHash != null
    if (tokenHasPassword && dbUser.password !== payload.passwordHash) {
      return NextResponse.json(
        { success: false, error: "Session expired. Please log in again." },
        { status: 401 }
      )
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
        return NextResponse.json(
          { success: false, error: "Seller profile not found." },
          { status: 404 }
        )
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
        return NextResponse.json(
          { success: false, error: "Hotel seller profile not found." },
          { status: 404 }
        )
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
        return NextResponse.json(
          { success: false, error: "Restaurant seller profile not found." },
          { status: 404 }
        )
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
        return NextResponse.json(
          { success: false, error: "Rider profile not found." },
          { status: 404 }
        )
      }
      isApproved = Boolean(rider.isApproved)
      isSuspended = Boolean(rider.isSuspended || rider.status === "SUSPENDED")
      status = rider.status || (rider.isApproved ? "APPROVED" : "PENDING")
      onboardingCompleted = Boolean(rider.onboardingCompleted)
      adminFeedback = rider.adminFeedback ?? null
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported role for live status." },
        { status: 400 }
      )
    }

    const data: LiveStatusData = {
      userId: targetUserId,
      role: targetRole,
      isApproved,
      isSuspended,
      status,
      onboardingCompleted,
      adminFeedback,
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("[LiveStatusHelper] Error fetching live status:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
