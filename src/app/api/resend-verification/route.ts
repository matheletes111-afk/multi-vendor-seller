import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/** POST /api/resend-verification — Resend verification email/SMS. Body: { email, phone, phoneCountryCode } */
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
        where: { email },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true, name: true, email: true, phone: true, phoneCountryCode: true, isEmailVerified: true },
      })
    }

    if (!user) {
      return NextResponse.json({ error: "No account found with this credential." }, { status: 404 })
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Account is already verified. You can sign in." }, { status: 200 })
    }

    const verifyEmailOtp = randomBytes(32).toString("hex")
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${verifyEmailOtp}`

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp, emailVerificationExpires },
    })

    const sendPromises: Promise<any>[] = []
    if (user.phone) {
      sendPromises.push(
        sendEmailVerificationSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          verificationLink,
          name: user.name,
        })
      )
    }
    if (user.email) {
      sendPromises.push(
        sendVerificationEmail({
          to: user.email,
          verificationLink,
          name: user.name,
        })
      )
    }

    await Promise.allSettled(sendPromises)

    return NextResponse.json({
      message: user.email
        ? "Verification email and SMS sent. Please check your inbox or phone."
        : "Verification SMS sent. Please check your mobile phone.",
    }, { status: 200 })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
