import { NextRequest } from "next/server"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { UserRole, RiderStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type MobileRiderAuthResult =
  | {
      ok: true
      userId: string
      role: UserRole
      user: {
        id: string
        email: string
        name: string | null
        phone: string | null
        phoneCountryCode: string | null
        image: string | null
        isEmailVerified: boolean
      }
      rider: {
        id: string
        isApproved: boolean
        isSuspended: boolean
        status: RiderStatus
        onboardingCompleted: boolean
        isFirstLogin: boolean
        vehicleTypes: any
        vehicleNumber: string | null
        drivingLicenseNo: string | null
        profileImage: string | null
        drivingLicenseDoc: string | null
        nationalIdDoc: string | null
        vehicleInsuranceDoc: string | null
        selectedZones: any
        selectedLocations: any
        deviceTokens: any
      }
    }
  | { ok: false; error: "unauthorized" | "forbidden" | "suspended" }

/**
 * Verifies mobile bearer token and ensures the authenticated user is an active Delivery Rider.
 */
export async function getMobileRiderAuth(request: NextRequest): Promise<MobileRiderAuthResult> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "unauthorized" }
  }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)

  if (!payload || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, error: "unauthorized" }
  }

  const role = payload.role as UserRole
  if (role !== UserRole.RIDER) {
    return { ok: false, error: "forbidden" }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        phone: true,
        phoneCountryCode: true,
        image: true,
        isEmailVerified: true,
        rider: true,
      },
    })

    if (!dbUser || !dbUser.rider) {
      return { ok: false, error: "unauthorized" }
    }

    // Verify password hash if token has passwordHash (session invalidation check)
    const tokenHasPassword = payload.passwordHash != null
    if (tokenHasPassword && dbUser.password !== payload.passwordHash) {
      return { ok: false, error: "unauthorized" }
    }

    // Check if rider is suspended
    if (dbUser.rider.isSuspended || dbUser.rider.status === "SUSPENDED") {
      return { ok: false, error: "suspended" }
    }

    const { password: _, rider, ...userInfo } = dbUser

    return {
      ok: true,
      userId: payload.userId,
      role,
      user: userInfo,
      rider,
    }
  } catch (error) {
    console.error("Error verifying mobile rider auth:", error)
    return { ok: false, error: "unauthorized" }
  }
}
