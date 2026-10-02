import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createOtpLoginToken } from "@/lib/web-otp-login"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { getFirstAllowedPath } from "@/lib/permissions"

/** POST /api/backoffice/auth/email-otp/verify-otp — Body: { email, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and 6-digit OTP are required." }, { status: 400 })
    }

    const rateLimitKey = `backoffice:${email}:verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        OR: [
          { isBackofficeUser: true },
          { role: UserRole.ADMIN },
        ],
      },
      include: { backofficeRole: true },
    })

    if (!user) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    }

    if (user.isBackofficeUser && user.backofficeRole && !user.backofficeRole.isActive) {
      return NextResponse.json(
        { error: "Account Suspended: Your assigned backoffice role has been deactivated." },
        { status: 403 }
      )
    }

    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 })
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "OTP has expired. Please request a new code." }, { status: 400 })
    }

    // Reset OTP and rate limit
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })
    await resetOtpRateLimit(rateLimitKey)

    // Compute target landing path
    let permissions: string[] = []
    if (user.backofficeRole?.permissions) {
      try {
        permissions = Array.isArray(user.backofficeRole.permissions)
          ? (user.backofficeRole.permissions as string[])
          : JSON.parse((user.backofficeRole.permissions as string) || "[]")
      } catch {
        permissions = []
      }
    }

    const targetUrl = user.role === UserRole.ADMIN && !user.isBackofficeUser
      ? "/admin"
      : getFirstAllowedPath(permissions)

    const otpLoginToken = createOtpLoginToken(email, UserRole.ADMIN, {
      userId: user.id,
      email: user.email,
      phone: user.phone,
    })

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully.",
      otpLoginToken,
      loginUrl: targetUrl,
    }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice email-otp verify error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to verify email OTP." },
      { status: 500 }
    )
  }
}
