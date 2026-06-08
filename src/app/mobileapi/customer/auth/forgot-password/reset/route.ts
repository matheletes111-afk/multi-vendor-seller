import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

interface ResetRequest {
  email: string
  otp: string
  newPassword: string
}

type ApiResponse =
  | { success: true; message: string; data: { loginUrl: string } }
  | { success: false; error: string; expired?: boolean }

/** POST /mobileapi/customer/auth/forgot-password/reset */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<ResetRequest>
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ success: false, error: "Email, OTP and newPassword are required" }, { status: 400 })
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ success: false, error: "OTP must be 6 digits" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.CUSTOMER },
      select: { id: true, isEmailVerified: true, verifyEmailOtp: true, emailVerificationExpires: true },
    })
    if (
      !user ||
      !user.isEmailVerified ||
      user.verifyEmailOtp !== otp ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      return NextResponse.json({ success: false, error: "Invalid email or OTP" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verifyEmailOtp: null,
        emailVerificationExpires: null,
        emailOtpSentAt: null,
      },
    })

    return NextResponse.json(
      { success: true, message: "Password reset successful.", data: { loginUrl: "/customer/login?reset=1" } },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile customer forgot-password reset error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
