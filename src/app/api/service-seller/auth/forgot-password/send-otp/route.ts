import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendPasswordResetSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/service-seller/auth/forgot-password/send-otp — Body: { email, phone, phoneCountryCode } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""

    if (!email && !phone) return NextResponse.json({ error: "Email or mobile number is required." }, { status: 400 })

    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { email, role: UserRole.SELLER_SERVICE },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.SELLER_SERVICE },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    }

    if (!user || !user.isEmailVerified) {
      return NextResponse.json({ message: "If an account exists with this credential, OTP has been sent." }, { status: 200 })
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
    const identifierParam = user.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || "")}`
    const resetLink = `${baseUrl}/service-seller/reset-password?${identifierParam}`

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

    return NextResponse.json({ message: "If an account exists with this credential, OTP has been sent." }, { status: 200 })
  } catch (error) {
    console.error("Service seller forgot-password send-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
