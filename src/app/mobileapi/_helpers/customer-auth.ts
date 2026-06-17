import { NextRequest } from "next/server"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { prisma } from "@/lib/prisma"

export type MobileCustomerAuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: "unauthorized" }

export async function getMobileCustomerAuth(request: NextRequest): Promise<MobileCustomerAuthResult> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, error: "unauthorized" }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER" || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, error: "unauthorized" }
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
    console.error("Error verifying customer password hash:", error)
    return { ok: false, error: "unauthorized" }
  }

  return { ok: true, userId: payload.userId }
}
