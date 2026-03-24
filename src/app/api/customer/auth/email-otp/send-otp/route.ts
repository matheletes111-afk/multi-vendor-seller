import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendLoginOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/customer/auth/email-otp/send-otp — Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.CUSTOMER },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "No account found for this email in customer panel." }, { status: 404 })
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
    await sendLoginOtpEmail({ to: email, otp, name: user.name })

    return NextResponse.json({ message: "OTP sent to your email." }, { status: 200 })
  } catch (error) {
    console.error("Customer email-otp send error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
