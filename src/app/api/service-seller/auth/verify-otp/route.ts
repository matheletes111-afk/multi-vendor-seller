import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/** POST /api/service-seller/auth/verify-otp — Body: { email, phone, otp, phoneCountryCode } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

    if ((!email && !phone) || !otp) {
      return NextResponse.json({ error: "Email or mobile number, and OTP are required" }, { status: 400 })
    }

    const rateLimitKey = `${email || phone}:reg-verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }, { status: 429 })
    }

    let user = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { email, role: UserRole.SELLER_SERVICE },
        select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.SELLER_SERVICE },
        select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
      })
    }

    if (!user) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid email/mobile number or OTP." }, { status: 400 })
    }
    if (user.isEmailVerified) return NextResponse.json({ message: "Already verified.", loginUrl: "/service-seller/login" }, { status: 200 })
    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })
    }
    const now = new Date()
    if (!user.emailVerificationExpires || user.emailVerificationExpires < now) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    await resetOtpRateLimit(rateLimitKey)

    return NextResponse.json({ message: "Account successfully verified.", loginUrl: "/service-seller/login?verified=1" }, { status: 200 })
  } catch (error) {
    console.error("Service seller verify-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
