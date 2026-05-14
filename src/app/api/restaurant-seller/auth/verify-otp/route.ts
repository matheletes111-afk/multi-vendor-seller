import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, otp } = body
    if (!email || !otp) return NextResponse.json({ error: "Email and OTP required" }, { status: 400 })
    
    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_RESTAURANT },
      select: { id: true, verifyEmailOtp: true, emailVerificationExpires: true, isEmailVerified: true },
    })
    
    if (!user) return NextResponse.json({ error: "Invalid email or OTP." }, { status: 400 })
    if (user.isEmailVerified) return NextResponse.json({ message: "Already verified.", loginUrl: "/restaurant-seller/login" }, { status: 200 })
    if (user.verifyEmailOtp !== otp) return NextResponse.json({ error: "Invalid OTP." }, { status: 400 })
    
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return NextResponse.json({ error: "OTP expired." }, { status: 400 })
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, verifyEmailOtp: null, emailVerificationExpires: null, emailOtpSentAt: null },
    })
    return NextResponse.json({ message: "Email verified.", loginUrl: "/restaurant-seller/login?verified=1" }, { status: 200 })
  } catch (error) {
    console.error("Restaurant verify-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
