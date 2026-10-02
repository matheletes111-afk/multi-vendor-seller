import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber, sendSmsViaTwilio } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/backoffice/auth/phone-otp/send-otp — Body: { phone } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone)) {
      return NextResponse.json(
        { error: "Enter a valid phone number with country code. Example: +23277123456" },
        { status: 400 }
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
      return NextResponse.json(
        { error: "No authorized backoffice account found with this phone number." },
        { status: 404 }
      )
    }

    if (user.isBackofficeUser && user.backofficeRole && !user.backofficeRole.isActive) {
      return NextResponse.json(
        { error: "Account Suspended: Your assigned backoffice role has been deactivated." },
        { status: 403 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { error: `Please wait ${waitSec} seconds before requesting another OTP.` },
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

    // Determine target phone number considering stored country code
    let toPhone = normalizedPhone
    if (user.phoneCountryCode && user.phone && !user.phone.startsWith("+")) {
      const cleanDigits = user.phone.replace(/\D/g, "").replace(/^0+/, "")
      const cc = user.phoneCountryCode.startsWith("+") ? user.phoneCountryCode : `+${user.phoneCountryCode}`
      toPhone = `${cc}${cleanDigits}`
    }

    try {
      await sendSmsViaTwilio({
        to: toPhone,
        body: `Your Meeem Backoffice login OTP is ${otp}. It expires in 10 minutes.`,
      })
    } catch (smsError) {
      console.warn("SMS dispatch error via Twilio:", smsError)
    }

    return NextResponse.json({ message: "Login OTP sent to your phone via SMS." }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice phone-otp send error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to dispatch SMS OTP." },
      { status: 500 }
    )
  }
}
