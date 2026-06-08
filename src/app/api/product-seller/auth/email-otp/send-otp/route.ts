import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendLoginOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/product-seller/auth/email-otp/send-otp — Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_PRODUCT },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })

    if (!user) {
      // Generic response to prevent account enumeration
      return NextResponse.json({ message: "If an account with this email exists, OTP has been sent." }, { status: 200 })
    }
    if (!user.isEmailVerified) {
      return NextResponse.json({ error: "Please verify your email first before OTP login." }, { status: 400 })
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSec} seconds before requesting another OTP.` }, { status: 429 })
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
    const mailResult = await sendLoginOtpEmail({ to: email, otp, name: user.name })
    if (mailResult && mailResult.success === false) {
      throw mailResult.error || new Error("SendGrid failed to dispatch email.")
    }
    return NextResponse.json({ message: "OTP sent to your email." }, { status: 200 })
  } catch (error: any) {
    console.error("Product seller email-otp send error:", error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
