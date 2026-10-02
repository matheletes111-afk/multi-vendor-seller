import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendPasswordResetSms, normalizePhoneNumber } from "@/lib/twilio-sms"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 15 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/backoffice/auth/forgot-password/send-otp — Body: { identifier } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawIdentifier = (typeof body.identifier === "string" ? body.identifier : typeof body.email === "string" ? body.email : "").trim()

    if (!rawIdentifier) {
      return NextResponse.json({ error: "Email address or phone number is required." }, { status: 400 })
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
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          phoneCountryCode: true,
          emailOtpSentAt: true,
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
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          phoneCountryCode: true,
          emailOtpSentAt: true,
        },
      })
    }

    if (!user) {
      // Don't leak whether account exists or not
      return NextResponse.json(
        { message: "If an account exists, a password reset code has been sent." },
        { status: 200 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { error: `Please wait ${waitSec} seconds before requesting another code.` },
        { status: 429 }
      )
    }

    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: otp,
        emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS),
        emailOtpSentAt: now,
      },
    })

    const baseUrl = getAppBaseUrl(request)
    const resetLink = `${baseUrl}/backoffice/reset-password?identifier=${encodeURIComponent(user.email || user.phone || rawIdentifier)}`

    // Dispatch via Email and/or SMS in parallel
    const promises: Promise<any>[] = []
    if (user.email) {
      promises.push(
        sendPasswordResetOtpEmail({
          to: user.email,
          otp,
          name: user.name,
          resetLink,
        })
      )
    }
    if (user.phone) {
      promises.push(
        sendPasswordResetSms({
          to: user.phone,
          countryCode: user.phoneCountryCode || "+232",
          otp,
          name: user.name,
          resetLink,
        })
      )
    }

    await Promise.allSettled(promises)

    return NextResponse.json({
      message: "If an account exists, a password reset code has been sent.",
      identifier: user.email || user.phone,
    }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice forgot-password send-otp error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to dispatch password reset code." },
      { status: 500 }
    )
  }
}
