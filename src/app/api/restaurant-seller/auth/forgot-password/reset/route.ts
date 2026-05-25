import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** POST /api/restaurant-seller/auth/forgot-password/reset — Body: { email, otp, newPassword } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: "Email, OTP and new password are required." }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_RESTAURANT },
      select: { id: true, isEmailVerified: true, verifyEmailOtp: true, emailVerificationExpires: true },
    })
    if (!user || !user.isEmailVerified) return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })

    const now = new Date()
    if (!user.emailVerificationExpires || user.emailVerificationExpires < now) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })

    return NextResponse.json({ message: "Password reset successful.", loginUrl: "/restaurant-seller/login?reset=1" }, { status: 200 })
  } catch (error) {
    console.error("Restaurant seller forgot-password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
