import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"

import { getAppBaseUrl, sendPasswordResetSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/restaurant-seller/auth/forgot-password/send-otp — Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_RESTAURANT },
      select: { id: true, name: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
    })

    if (!user || !user.isEmailVerified) {
      return NextResponse.json({ message: "If an account exists for this email, OTP has been sent." }, { status: 200 })
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSec} seconds before requesting another OTP.` }, { status: 429 })
    }

    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: otp, emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS), emailOtpSentAt: now },
    })

    const baseUrl = getAppBaseUrl(request)
    const resetLink = `${baseUrl}/restaurant-seller/reset-password?email=${encodeURIComponent(email)}`

    await Promise.allSettled([
      sendPasswordResetOtpEmail({ to: email, otp, name: user.name, resetLink }),
      sendPasswordResetSms({
        to: user.phone,
        countryCode: user.phoneCountryCode,
        otp,
        name: user.name,
        resetLink,
      }),
    ])

    return NextResponse.json({ message: "If an account exists for this email, OTP has been sent." }, { status: 200 })
  } catch (error) {
    console.error("Restaurant seller forgot-password send-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
