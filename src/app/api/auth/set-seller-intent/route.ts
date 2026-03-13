import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

const AUTH_INTENDED_ROLE_COOKIE = "auth_intended_role"
const ALLOWED_ROLES = [UserRole.SELLER_PRODUCT, UserRole.SELLER_SERVICE] as const
const ALLOWED_CALLBACKS: Record<string, string> = {
  [UserRole.SELLER_PRODUCT]: "/product-seller",
  [UserRole.SELLER_SERVICE]: "/service-seller",
}
const ALLOWED_PROVIDERS = ["google", "facebook"]

/**
 * GET /api/auth/set-seller-intent?role=SELLER_PRODUCT|SELLER_SERVICE&callbackUrl=...&provider=google|facebook
 * Sets auth_intended_role cookie so OAuth createUser sees the cookie.
 * Call this from product-seller and service-seller login pages before calling signIn().
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get("role")
  const callbackUrl = searchParams.get("callbackUrl")
  const provider = searchParams.get("provider")

  if (!role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 })
  }
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 })
  }

  const allowedCallback = ALLOWED_CALLBACKS[role]
  const finalCallbackUrl = callbackUrl && (callbackUrl === allowedCallback || callbackUrl.startsWith(allowedCallback + "/"))
    ? callbackUrl
    : allowedCallback

  const res = NextResponse.json({ ok: true, callbackUrl: finalCallbackUrl })
  res.cookies.set(AUTH_INTENDED_ROLE_COOKIE, role, {
    path: "/",
    maxAge: 300,
    sameSite: "lax",
    httpOnly: false, // cookie is read server-side in createUser
  })
  return res
}
