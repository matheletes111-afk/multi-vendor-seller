import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendLoginOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

type ApiResponse =
  | { success: true; message: string; data: { email: string; expiresIn: number; resendCooldown: number } }
  | { success: false; error: string; waitTime?: number }

/** POST /mobileapi/service-seller/auth/email-otp/send-otp — Body: { email } */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_SERVICE },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "No account found for this email in service seller panel." }, { status: 404 })
    }
    if (!user.isEmailVerified) {
      return NextResponse.json({ success: false, error: "Please verify your email first before OTP login." }, { status: 400 })
    }

    if (user.emailOtpSentAt) {
      const diff = Date.now() - user.emailOtpSentAt.getTime()
      if (diff < RESEND_COOLDOWN_MS) {
        const waitTime = Math.ceil((RESEND_COOLDOWN_MS - diff) / 1000)
        return NextResponse.json(
          { success: false, error: `Please wait ${waitTime} seconds before requesting a new OTP`, waitTime },
          { status: 429 }
        )
      }
    }

    const otp = randomInt(100000, 999999).toString()
    const now = new Date()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: otp,
        emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS),
        emailOtpSentAt: now,
      },
    })
    await sendLoginOtpEmail({ to: email, otp, name: user.name })

    return NextResponse.json({
      success: true,
      message: "Login OTP sent successfully",
      data: { email, expiresIn: OTP_EXPIRY_MS / 1000, resendCooldown: RESEND_COOLDOWN_MS / 1000 },
    })
  } catch (error) {
    console.error("Mobile service seller email-otp send error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
