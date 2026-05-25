import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { isValidE164, normalizePhoneNumber, sendSmsViaTwilio } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

type ApiResponse =
  | { success: true; message: string; data: { phone: string; expiresIn: number; resendCooldown: number } }
  | { 
      success: false; 
      error: string; 
      waitTime?: number;
      needsVerification?: boolean;
      authStatus?: string;
      verifyUrl?: string;
      data?: { email?: string; phone?: string }
    }

/** POST /mobileapi/restaurant-seller/auth/phone-otp/send-otp — Body: { phone } */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneInput = typeof body.phone === "string" ? body.phone : ""
    const normalizedPhone = normalizePhoneNumber(phoneInput)

    if (!isValidE164(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid phone number with country code. Example: +919876543210" },
        { status: 400 }
      )
    }

    const phoneDigits = normalizedPhone.replace(/^\+/, "")
    const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.SELLER_RESTAURANT,
        OR: [
          { phone: normalizedPhone },
          { phone: phoneDigits },
          ...splitPairs.map((pair) => ({
            phoneCountryCode: pair.countryCode,
            phone: pair.phone,
          })),
        ],
      },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No restaurant seller account found with this phone number." },
        { status: 404 }
      )
    }
    if (!user.isEmailVerified) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Please verify your email first.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: "/mobileapi/restaurant-seller/verify-otp",
          data: { phone: normalizedPhone }
        }, 
        { status: 403 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitTime = Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${waitTime} seconds before requesting a new OTP`, waitTime },
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

    await sendSmsViaTwilio({
      to: normalizedPhone,
      body: `Your login OTP is ${otp}. It expires in 10 minutes.`,
    })

    return NextResponse.json({
      success: true,
      message: "Login OTP sent successfully",
      data: {
        phone: normalizedPhone,
        expiresIn: OTP_EXPIRY_MS / 1000,
        resendCooldown: RESEND_COOLDOWN_MS / 1000,
      },
    })
  } catch (error) {
    console.error("Mobile restaurant seller phone-otp send error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
