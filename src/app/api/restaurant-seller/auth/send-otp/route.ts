import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })
    
    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.SELLER_RESTAURANT },
      select: { id: true, name: true, isEmailVerified: true, emailOtpSentAt: true },
    })
    
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 })
    if (user.isEmailVerified) return NextResponse.json({ message: "Already verified.", loginUrl: "/restaurant-seller/login" }, { status: 200 })
    
    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: "Wait before requesting again." }, { status: 429 })
    }
    
    const otp = randomInt(100000, 999999).toString()
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp: otp, emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS), emailOtpSentAt: now },
    })
    
    await sendVerificationOtpEmail({ to: email, otp, name: user.name })
    return NextResponse.json({ message: "OTP sent." }, { status: 200 })
  } catch (error) {
    console.error("Restaurant send-otp error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
