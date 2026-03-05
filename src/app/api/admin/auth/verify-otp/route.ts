import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

/** POST /api/admin/auth/verify-otp — Verify 6-digit OTP. Body: { email, otp } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 })
    }
    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.ADMIN },
      select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    }
    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Already verified.", loginUrl: "/admin/login" }, { status: 200 })
    }
    if (user.verifyEmailOtp !== otp) {
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })
    }
    const now = new Date()
    if (!user.emailVerificationExpires || user.emailVerificationExpires < now) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })
    return NextResponse.json({ message: "Email verified.", loginUrl: "/admin/login?verified=1" }, { status: 200 })
  } catch (error) {
    console.error("Admin verify-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
