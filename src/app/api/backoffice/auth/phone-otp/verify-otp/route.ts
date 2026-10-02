import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createOtpLoginToken } from "@/lib/web-otp-login"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber } from "@/lib/twilio-sms"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { getFirstAllowedPath } from "@/lib/permissions"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/** POST /api/backoffice/auth/phone-otp/verify-otp — Body: { phone, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone) || !otp) {
      return NextResponse.json(
        { error: "Valid phone number and 6-digit OTP code are required." },
        { status: 400 }
      )
    }

    const rateLimitKey = `backoffice:${normalizedPhone}:verify-otp`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      )
    }

    const phoneDigits = normalizedPhone.replace(/^\+/, "")
    const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
    const variants = getEquivalentPhoneVariants(normalizedPhone)

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { isBackofficeUser: true },
          { role: UserRole.ADMIN },
        ],
        AND: [
          {
            OR: [
              { phone: { in: variants } },
              { phone: phoneInput },
              { phone: normalizedPhone },
              { phone: phoneDigits },
              ...splitPairs.map((pair) => ({
                phoneCountryCode: pair.countryCode,
                phone: pair.phone,
              })),
            ],
          },
        ],
      },
      include: { backofficeRole: true },
    })

    if (!user) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid phone number or OTP." }, { status: 400 })
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

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    await resetOtpRateLimit(rateLimitKey)

    // Compute intelligent landing page
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

    const otpLoginToken = createOtpLoginToken(user.email || user.phone || normalizedPhone, UserRole.ADMIN, {
      userId: user.id,
      phone: user.phone,
      email: user.email,
    })

    return NextResponse.json({
      success: true,
      message: "Phone OTP verified.",
      otpLoginToken,
      email: user.email,
      phone: user.phone,
      loginUrl: targetUrl,
    }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice phone-otp verify error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to verify phone OTP." },
      { status: 500 }
    )
  }
}
