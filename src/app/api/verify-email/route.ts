import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

/** GET /api/verify-email?token=xxx — Verify email from link, then redirect to panel login. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  const origin = new URL(request.url).origin

  if (!token) {
    return NextResponse.redirect(origin + "/?error=missing_token")
  }

  const user = await prisma.user.findFirst({
    where: { verifyEmailOtp: token },
  })

  if (!user) {
    return NextResponse.redirect(origin + "/?error=invalid_or_expired_token")
  }

  const now = new Date()
  if (user.emailVerificationExpires && user.emailVerificationExpires < now) {
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null },
    })
    return NextResponse.redirect(origin + "/?error=verification_expired")
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      verifyEmailOtp: null,
      emailVerificationExpires: null,
    },
  })

  const loginPaths: Record<string, string> = {
    [UserRole.ADMIN]: "/admin/login",
    [UserRole.CUSTOMER]: "/customer/login",
    [UserRole.SELLER_PRODUCT]: "/product-seller/login",
    [UserRole.SELLER_SERVICE]: "/service-seller/login",
  }
  const loginPath = loginPaths[user.role] ?? "/customer/login"
  return NextResponse.redirect(origin + loginPath + "?verified=1")
}
