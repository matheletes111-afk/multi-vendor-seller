import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"

/** POST /api/resend-verification — Resend verification email. Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = body.email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
      select: { id: true, name: true, isEmailVerified: true },
    })
    if (!user) {
      return NextResponse.json({ error: "No account found with this email." }, { status: 404 })
    }
    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Email is already verified. You can sign in." }, { status: 200 })
    }
    const verifyEmailOtp = randomBytes(32).toString("hex")
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const origin = new URL(request.url).origin
    const verificationLink = `${origin}/api/verify-email?token=${verifyEmailOtp}`

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailOtp, emailVerificationExpires },
    })

    await sendVerificationEmail({
      to: email.trim(),
      verificationLink,
      name: user.name,
    })

    return NextResponse.json({ message: "Verification email sent. Please check your inbox." }, { status: 200 })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
