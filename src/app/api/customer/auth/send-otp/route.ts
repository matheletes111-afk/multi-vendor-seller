import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/customer/auth/send-otp — Send 6-digit OTP. Body: { email, phone, phoneCountryCode } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""

    if (!email && !phone) {
      return NextResponse.json({ error: "Mobile number or email is required" }, { status: 400 })
    }

    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { email, role: UserRole.CUSTOMER },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.CUSTOMER },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true, emailOtpSentAt: true },
      })
    }

    if (!user) {
      return NextResponse.json({ error: "No account found with this credential." }, { status: 404 })
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Account is already verified.", loginUrl: "/customer/login" }, { status: 200 })
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

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${otp}`

    const sendPromises: Promise<any>[] = []
    if (user.phone) {
      sendPromises.push(
        sendEmailVerificationSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          verificationLink,
          otp,
          name: user.name,
        })
      )
    }
    if (user.email) {
      sendPromises.push(
        sendVerificationOtpEmail({ to: user.email, otp, name: user.name, verificationLink })
      )
    }

    await Promise.allSettled(sendPromises)

    return NextResponse.json({
      message: user.email
        ? "OTP sent to your email and mobile number."
        : "OTP sent to your mobile number via SMS.",
    }, { status: 200 })
  } catch (error) {
    console.error("Customer send-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
