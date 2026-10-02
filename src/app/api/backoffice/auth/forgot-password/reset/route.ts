import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { normalizePhoneNumber } from "@/lib/twilio-sms"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { checkOtpRateLimit, recordOtpFailure, resetOtpRateLimit } from "@/lib/rate-limit"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/** POST /api/backoffice/auth/forgot-password/reset — Body: { identifier, otp, newPassword } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawIdentifier = (typeof body.identifier === "string" ? body.identifier : typeof body.email === "string" ? body.email : "").trim()
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!rawIdentifier || !otp || !newPassword) {
      return NextResponse.json(
        { error: "Account identifier, 6-digit OTP code, and new password are required." },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      )
    }

    const rateLimitKey = `backoffice-reset:${rawIdentifier}:verify`
    const rateCheck = await checkOtpRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.blockTimeLeftMs / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      )
    }

    const isEmail = rawIdentifier.includes("@")
    let user: any = null

    if (isEmail) {
      user = await prisma.user.findFirst({
        where: {
          email: rawIdentifier.toLowerCase(),
          OR: [
            { isBackofficeUser: true },
            { role: UserRole.ADMIN },
          ],
        },
      })
    } else {
      const normalizedPhone = normalizePhoneNumber(rawIdentifier)
      const phoneDigits = normalizedPhone.replace(/^\+/, "")
      const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
      const variants = getEquivalentPhoneVariants(rawIdentifier)

      user = await prisma.user.findFirst({
        where: {
          OR: [
            { isBackofficeUser: true },
            { role: UserRole.ADMIN },
          ],
          AND: [
            {
              OR: [
                { phone: { in: variants } },
                { phone: rawIdentifier },
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
      })
    }

    if (!user) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid identifier or OTP code." }, { status: 400 })
    }

    if (user.verifyEmailOtp !== otp) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 })
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      await recordOtpFailure(rateLimitKey)
      return NextResponse.json({ error: "OTP code has expired. Please request a new one." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verifyEmailOtp: null,
        emailVerificationExpires: null,
        emailOtpSentAt: null,
        forcePasswordChange: false,
      },
    })

    await resetOtpRateLimit(rateLimitKey)

    return NextResponse.json({
      success: true,
      message: "Your password has been reset successfully. You can now log in.",
    }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice forgot-password reset error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to reset password." },
      { status: 500 }
    )
  }
}
