import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createOtpLoginToken } from "@/lib/web-otp-login"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"

/** POST /api/restaurant-seller/auth/email-otp/verify-otp — Body: { email, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    if (!email || !otp) return NextResponse.json({ error: "Email and OTP are required." }, { status: 400 })

    const rateLimitKey = `${email}:verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }, { status: 429 })
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_RESTAURANT },
      select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
    })
    if (!user || !user.isEmailVerified) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    }
    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })
    }
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    await resetOtpRateLimit(rateLimitKey)

    const otpLoginToken = createOtpLoginToken(email, UserRole.SELLER_RESTAURANT)
    return NextResponse.json({ message: "OTP verified.", otpLoginToken, loginUrl: "/restaurant-seller" }, { status: 200 })
  } catch (error) {
    console.error("Restaurant seller email-otp verify error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
