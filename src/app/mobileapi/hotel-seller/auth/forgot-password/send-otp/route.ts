import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendPasswordResetSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

type ApiResponse =
  | { success: true; message: string; data: { email: string | null; phone: string | null; expiresIn: number; resendCooldown: number } }
  | { success: false; error: string; waitTime?: number }

/** POST /mobileapi/hotel-seller/auth/forgot-password/send-otp */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; phone?: string; identifier?: string; phoneCountryCode?: string }
    const rawIdentifier = typeof body.identifier === "string" ? body.identifier.trim() : ""
    let email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    let phone = typeof body.phone === "string" ? body.phone.trim() : ""
    if (!email && !phone && rawIdentifier) {
      if (rawIdentifier.includes("@")) {
        email = rawIdentifier.toLowerCase()
      } else {
        phone = rawIdentifier
      }
    }
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""

    if (!email && !phone) return NextResponse.json({ success: false, error: "Email or mobile number is required" }, { status: 400 })

    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { email, role: UserRole.SELLER_HOTEL },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.SELLER_HOTEL },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    }

    if (!user || !user.isEmailVerified) {
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists with this credential, OTP has been sent.",
          data: { email: email || null, phone: phone || null, expiresIn: OTP_EXPIRY_MS / 1000, resendCooldown: RESEND_COOLDOWN_MS / 1000 },
        },
        { status: 200 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt) {
      const diff = now.getTime() - user.emailOtpSentAt.getTime()
      if (diff < RESEND_COOLDOWN_MS) {
        const waitTime = Math.ceil((RESEND_COOLDOWN_MS - diff) / 1000)
        return NextResponse.json(
          { success: false, error: `Please wait ${waitTime} seconds before requesting a new OTP`, waitTime },
          { status: 429 }
        )
      }
    }

    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: otp, emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS), emailOtpSentAt: now },
    })

    const baseUrl = getAppBaseUrl(request)
    const identifierParam = user.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || "")}`
    const resetLink = `${baseUrl}/hotel-seller/reset-password?${identifierParam}`

    const sendPromises: Promise<any>[] = []
    if (user.phone) {
      sendPromises.push(
        sendPasswordResetSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          otp,
          name: user.name,
          resetLink,
        })
      )
    }
    if (user.email) {
      sendPromises.push(
        sendPasswordResetOtpEmail({ to: user.email, otp, name: user.name, resetLink })
      )
    }

    await Promise.allSettled(sendPromises)

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists with this credential, OTP has been sent.",
        data: { email: user.email, phone: user.phone, expiresIn: OTP_EXPIRY_MS / 1000, resendCooldown: RESEND_COOLDOWN_MS / 1000 },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile hotel-seller forgot-password send-otp error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
