import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendPasswordResetSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.RIDER },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        emailOtpSentAt: true,
        rider: {
          select: {
            isSuspended: true,
            status: true,
          },
        },
      },
    })

    // Avoid email enumeration
    if (!user || user.rider?.isSuspended || user.rider?.status === "SUSPENDED") {
      return NextResponse.json(
        {
          success: true,
          message: "If an active rider account exists for this email, a reset OTP has been sent.",
          data: { email, expiresIn: OTP_EXPIRY_MS / 1000 },
        },
        { status: 200 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${waitSec} seconds before requesting another OTP.` },
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
    const resetLink = `${baseUrl}/riderapp/reset-password?email=${encodeURIComponent(email)}`

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

    return NextResponse.json(
      {
        success: true,
        message: "Password reset OTP has been sent to your email and phone.",
        data: {
          email,
          expiresIn: OTP_EXPIRY_MS / 1000,
          resendCooldown: 60,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile rider forgot-password send-otp error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
