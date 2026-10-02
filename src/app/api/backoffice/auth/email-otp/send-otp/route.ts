import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendLoginOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

/** POST /api/backoffice/auth/email-otp/send-otp — Body: { email } */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        OR: [
          { isBackofficeUser: true },
          { role: UserRole.ADMIN },
        ],
      },
      include: { backofficeRole: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "No authorized backoffice account found with this email." },
        { status: 404 }
      )
    }

    if (user.isBackofficeUser && user.backofficeRole && !user.backofficeRole.isActive) {
      return NextResponse.json(
        { error: "Account Suspended: Your assigned backoffice role has been deactivated." },
        { status: 403 }
      )
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
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: otp,
        emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS),
        emailOtpSentAt: now,
      },
    })

    const mailResult = await sendLoginOtpEmail({
      to: email,
      otp,
      name: user.name,
    })

    if (mailResult && mailResult.success === false) {
      console.warn("SendGrid email dispatch warning:", (mailResult as any).error)
    }

    return NextResponse.json({ message: "Login OTP sent to your email." }, { status: 200 })
  } catch (error: any) {
    console.error("Backoffice email-otp send error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to dispatch login OTP." },
      { status: 500 }
    )
  }
}
