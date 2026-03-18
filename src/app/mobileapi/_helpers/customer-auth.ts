import { NextRequest } from "next/server"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export type MobileCustomerAuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: "unauthorized" }

export function getMobileCustomerAuth(request: NextRequest): MobileCustomerAuthResult {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, error: "unauthorized" }

  const token = authHeader.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER" || typeof payload.userId !== "string" || !payload.userId) {
    return { ok: false, error: "unauthorized" }
  }

  return { ok: true, userId: payload.userId }
}

