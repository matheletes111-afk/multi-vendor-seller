import { NextRequest } from "next/server"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type MobileSellerAuthResult =
  | { ok: true; userId: string; role: UserRole }
  | { ok: false; error: "unauthorized" | "forbidden" }

/**
 * Verifies mobile bearer token and ensures the user is a seller.
 * @param request The incoming request
 * @param requiredRole Optional specific seller role (SELLER_PRODUCT or SELLER_SERVICE)
 */
export async function getMobileSellerAuth(
  request: NextRequest,
  requiredRole?: UserRole
): Promise<MobileSellerAuthResult> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, error: "unauthorized" }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)

  if (!payload || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, error: "unauthorized" }
  }

  // Check if role is a seller role
  const role = payload.role as UserRole
  if (role !== UserRole.SELLER_PRODUCT && role !== UserRole.SELLER_SERVICE) {
    return { ok: false, error: "forbidden" }
  }

  // If a specific role was requested, check it
  if (requiredRole && role !== requiredRole) {
    return { ok: false, error: "forbidden" }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { password: true }
    })
    if (!dbUser) {
      return { ok: false, error: "unauthorized" }
    }
    const tokenHasPassword = payload.passwordHash != null
    const dbHasPassword = dbUser.password != null
    if (
      (tokenHasPassword && dbUser.password !== payload.passwordHash) ||
      (dbHasPassword && dbUser.password !== payload.passwordHash)
    ) {
      return { ok: false, error: "unauthorized" }
    }
  } catch (error) {
    console.error("Error verifying seller password hash:", error)
    return { ok: false, error: "unauthorized" }
  }

  return { ok: true, userId: payload.userId, role }
}
