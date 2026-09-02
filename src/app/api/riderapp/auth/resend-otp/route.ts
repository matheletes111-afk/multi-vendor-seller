import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendRiderVerificationEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const COOLDOWN_MS = 60 * 1000 // 60 seconds

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
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
        { success: false, error: "Rider account not found for this email." },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Your email is already verified. You can sign in now.",
        isEmailVerified: true,
      })
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${waitSec} seconds before requesting another code.` },
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
        ...(user.phone
          ? [
              sendEmailVerificationSms({
                to: user.phone,
                countryCode: user.phoneCountryCode,
                verificationLink,
                otp: verifyEmailOtp,
                name: user.name,
              }),
            ]
          : []),
      ])
    } catch (sendError) {
      console.error("Failed to resend rider verification email/sms:", sendError)
    }

    return NextResponse.json({
      success: true,
      message: "A new 6-digit verification code and link has been sent to your email.",
      email: user.email,
      resendCooldown: 60,
    })
  } catch (error) {
    console.error("Rider resend-otp error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to resend verification code. Please try again." },
      { status: 500 }
    )
  }
}
