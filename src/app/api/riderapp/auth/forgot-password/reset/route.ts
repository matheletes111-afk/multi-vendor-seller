import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { normalizePhoneNumber } from "@/lib/twilio-sms"

/** POST /api/riderapp/auth/forgot-password/reset — Body: { email?, phone?, otp, newPassword } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phoneInput = typeof body.phone === "string" ? body.phone.trim() : ""
    const normalizedPhone = phoneInput ? normalizePhoneNumber(phoneInput) : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if ((!email && !normalizedPhone) || !otp || !newPassword) {
      return NextResponse.json({ error: "Email or phone, OTP, and new password are required." }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const rateLimitKey = `${email || normalizedPhone}:rider-forgot-password-reset`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      )
    }

    const whereOr: any[] = []
    if (email) {
      whereOr.push({ email })
    }
    if (normalizedPhone) {
      const phoneDigits = normalizedPhone.replace(/^\+/, "")
      const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
      whereOr.push(
        { phone: normalizedPhone },
        { phone: phoneDigits },
        ...splitPairs.map((pair) => ({
          phoneCountryCode: pair.countryCode,
          phone: pair.phone,
        }))
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.RIDER,
        OR: whereOr,
      },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
        rider: {
          select: {
            isSuspended: true,
            status: true,
          },
        },
      },
    })

    if (!user || user.rider?.isSuspended || user.rider?.status === "SUSPENDED") {
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
      return NextResponse.json({ error: "Invalid or expired OTP code." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verifyEmailOtp: null,
        emailVerificationExpires: null,
        emailOtpSentAt: null,
      },
    })

    // Also mark rider isFirstLogin as false if password reset is completed
    await prisma.rider.updateMany({
      where: { userId: user.id },
      data: { isFirstLogin: false },
    })

    await resetOtpRateLimit(rateLimitKey)

    return NextResponse.json(
      { message: "Password reset successful.", loginUrl: "/riderapp/login?reset=1" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Rider forgot-password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
