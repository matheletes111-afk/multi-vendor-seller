import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

type ApiResponse =
  | { success: true; message: string; data: { email: string; expiresIn: number; resendCooldown: number } }
  | { success: false; error: string; waitTime?: number }

/** POST /mobileapi/product-seller/auth/forgot-password/send-otp */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    if (!email) return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_PRODUCT },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })

    if (!user || !user.isEmailVerified) {
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists for this email, OTP has been sent.",
          data: { email, expiresIn: OTP_EXPIRY_MS / 1000, resendCooldown: RESEND_COOLDOWN_MS / 1000 },
        },
        { status: 200 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt) {
      const diff = now.getTime() - user.emailOtpSentAt.getTime()
      if (diff < RESEND_COOLDOWN_MS) {
        const waitTime = Math.ceil((RESEND_COOLDOWN_MS - diff) / 1000)
        return NextResponse.json(
          { success: false, error: `Please wait ${waitTime} seconds before requesting a new OTP`, waitTime },
          { status: 429 }
        )
      }
    }

    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: otp, emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS), emailOtpSentAt: now },
    })
    await sendPasswordResetOtpEmail({ to: email, otp, name: user.name })

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists for this email, OTP has been sent.",
        data: { email, expiresIn: OTP_EXPIRY_MS / 1000, resendCooldown: RESEND_COOLDOWN_MS / 1000 },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile product-seller forgot-password send-otp error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
