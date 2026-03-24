import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createOtpLoginToken } from "@/lib/web-otp-login"

/** POST /api/service-seller/auth/email-otp/verify-otp — Body: { email, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    if (!email || !otp) return NextResponse.json({ error: "Email and OTP are required." }, { status: 400 })

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_SERVICE },
      select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
    })
    if (!user || !user.isEmailVerified) return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    const otpLoginToken = createOtpLoginToken(email, UserRole.SELLER_SERVICE)
    return NextResponse.json({ message: "OTP verified.", otpLoginToken, loginUrl: "/service-seller" }, { status: 200 })
  } catch (error) {
    console.error("Service seller email-otp verify error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
