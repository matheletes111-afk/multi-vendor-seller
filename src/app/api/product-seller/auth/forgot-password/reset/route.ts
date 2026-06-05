import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"

/** POST /api/product-seller/auth/forgot-password/reset — Body: { email, otp, newPassword } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: "Email, OTP and new password are required." }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const rateLimitKey = `${email}:forgot-password-reset`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }, { status: 429 })
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_PRODUCT },
      select: { id: true, isEmailVerified: true, verifyEmailOtp: true, emailVerificationExpires: true },
    })
    if (!user || !user.isEmailVerified) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    }
    const now = new Date()
    if (
      user.verifyEmailOtp !== otp ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < now
    ) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    await resetOtpRateLimit(rateLimitKey)

    return NextResponse.json({ message: "Password reset successful.", loginUrl: "/product-seller/login?reset=1" }, { status: 200 })
  } catch (error) {
    console.error("Product seller forgot-password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
