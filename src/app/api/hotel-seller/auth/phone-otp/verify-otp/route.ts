import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createOtpLoginToken } from "@/lib/web-otp-login"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber } from "@/lib/twilio-sms"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"

/** POST /api/hotel-seller/auth/phone-otp/verify-otp — Body: { phone, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone) || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required." },
        { status: 400 }
      )
    }

    const rateLimitKey = `${normalizedPhone}:verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }, { status: 429 })
    }

    const phoneDigits = normalizedPhone.replace(/^\+/, "")
    const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.SELLER_HOTEL,
        OR: [
          { phone: normalizedPhone },
          { phone: phoneDigits },
          ...splitPairs.map((pair) => ({
            phoneCountryCode: pair.countryCode,
            phone: pair.phone,
          })),
        ],
      },
      select: { id: true, email: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
    })

    if (!user || !user.isEmailVerified) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid phone number or OTP." }, { status: 400 })
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

    const otpLoginToken = createOtpLoginToken(user.email, UserRole.SELLER_HOTEL)
    return NextResponse.json(
      { message: "OTP verified.", otpLoginToken, email: user.email, loginUrl: "/hotel-seller" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Hotel seller phone-otp verify error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
