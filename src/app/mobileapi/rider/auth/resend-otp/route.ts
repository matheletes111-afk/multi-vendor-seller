import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendRiderVerificationEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: "Mobile number or email is required" },
        { status: 400 }
      )
    }

    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
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
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.RIDER },
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
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Rider account not found." },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "Account is already verified.",
        data: { email: user.email, phone: user.phone, isEmailVerified: true },
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
    const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&phone=${encodeURIComponent(user.phone || "")}`

    try {
      const sendPromises: Promise<any>[] = []
      if (user.phone) {
        sendPromises.push(
          sendEmailVerificationSms({
            to: user.phone,
            countryCode: user.phoneCountryCode,
            verificationLink,
            otp: verifyEmailOtp,
            name: user.name,
          })
        )
      }
      if (user.email) {
        sendPromises.push(
          sendRiderVerificationEmail({
            to: user.email,
            name: user.name || "Delivery Rider",
            verificationLink,
            otp: verifyEmailOtp,
          })
        )
      }

      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to resend rider verification:", sendError)
    }

    return NextResponse.json({
      success: true,
      message: user.email
        ? "A new verification code has been sent to your mobile number and email."
        : "A new verification code has been sent to your mobile number via SMS.",
      data: {
        email: user.email,
        phone: user.phone,
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
