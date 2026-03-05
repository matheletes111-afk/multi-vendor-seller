import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000 // 1 min

/** POST /api/admin/auth/send-otp — Send 6-digit OTP to email. Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.ADMIN },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })
    if (!user) {
      return NextResponse.json({ error: "No admin account found with this email." }, { status: 404 })
    }
    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Email is already verified.", loginUrl: "/admin/login" }, { status: 200 })
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
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: otp, emailVerificationExpires, emailOtpSentAt: now },
    })
    await sendVerificationOtpEmail({ to: email, otp, name: user.name })
    return NextResponse.json({ message: "OTP sent to your email." }, { status: 200 })
  } catch (error) {
    console.error("Admin send-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
