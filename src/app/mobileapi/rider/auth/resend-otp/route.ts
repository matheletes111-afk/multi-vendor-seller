import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendRiderVerificationEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.RIDER },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        emailOtpSentAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Rider account not found." },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified.",
        data: { email: user.email, isEmailVerified: true },
      })
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${waitSec} seconds before requesting another OTP.` },
        { status: 429 }
      )
    }

    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
    })

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&email=${encodeURIComponent(user.email)}`

    try {
      await Promise.allSettled([
        sendRiderVerificationEmail({
          to: user.email,
          name: user.name || "Delivery Rider",
          verificationLink,
          otp: verifyEmailOtp,
        }),
        sendEmailVerificationSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          verificationLink,
          otp: verifyEmailOtp,
          name: user.name,
        }),
      ])
    } catch (sendError) {
      console.error("Failed to resend rider verification:", sendError)
    }

    return NextResponse.json({
      success: true,
      message: "New verification code has been sent.",
      data: {
        email: user.email,
        expiresIn: OTP_EXPIRY_MS / 1000,
        resendCooldown: 60,
      },
    })
  } catch (error) {
    console.error("Mobile rider resend-otp error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    )
  }
}
