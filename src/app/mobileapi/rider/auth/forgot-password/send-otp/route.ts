import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendPasswordResetSms, isValidE164, normalizePhoneNumber } from "@/lib/twilio-sms"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"

const OTP_EXPIRY_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawIdentifier = typeof body.identifier === "string" ? body.identifier.trim() : ""
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    let phoneInput = typeof body.phone === "string" ? body.phone.trim() : ""
    if (!email && !phoneInput && rawIdentifier) {
      if (rawIdentifier.includes("@")) {
        email = rawIdentifier.toLowerCase()
      } else {
        phoneInput = rawIdentifier
      }
    }
    const normalizedPhone = phoneInput ? normalizePhoneNumber(phoneInput) : ""

    if (!email && !normalizedPhone) {
      return NextResponse.json({ success: false, error: "Email or phone number is required." }, { status: 400 })
    }

    const whereOr: any[] = []
    if (email) {
      whereOr.push({ email })
    }
    if (normalizedPhone) {
      const phoneDigits = normalizedPhone.replace(/^\+/, "")
      const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
      whereOr.push(
        { phone: normalizedPhone },
        { phone: phoneDigits },
        ...splitPairs.map((pair) => ({
          phoneCountryCode: pair.countryCode,
          phone: pair.phone,
        }))
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.RIDER,
        OR: whereOr,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        emailOtpSentAt: true,
        rider: {
          select: {
            isSuspended: true,
            status: true,
          },
        },
      },
    })

    // Avoid email enumeration
    if (!user || user.rider?.isSuspended || user.rider?.status === "SUSPENDED") {
      return NextResponse.json(
        {
          success: true,
          message: "If an active rider account exists, a reset OTP has been sent.",
          data: { email: email || user?.email || "", phone: phoneInput || user?.phone || "", expiresIn: OTP_EXPIRY_MS / 1000 },
        },
        { status: 200 }
      )
    }

    const now = new Date()
    if (user.emailOtpSentAt && now.getTime() - user.emailOtpSentAt.getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now.getTime() - user.emailOtpSentAt.getTime())) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${waitSec} seconds before requesting another OTP.` },
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

    const baseUrl = getAppBaseUrl(request)
    const identifierParam = user.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || "")}`
    const resetLink = `${baseUrl}/riderapp/reset-password?${identifierParam}`

    const sendTasks: Promise<unknown>[] = []
    if (user.email) {
      sendTasks.push(sendPasswordResetOtpEmail({ to: user.email, otp, name: user.name, resetLink }))
    }
    if (user.phone) {
      sendTasks.push(
        sendPasswordResetSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          otp,
          name: user.name,
          resetLink,
        })
      )
    }
    await Promise.allSettled(sendTasks)

    return NextResponse.json(
      {
        success: true,
        message: user.email && user.phone
          ? "Password reset OTP has been sent to your email and phone."
          : user.phone
          ? "Password reset OTP has been sent to your mobile number."
          : "Password reset OTP has been sent to your email.",
        data: {
          email: user.email || "",
          phone: user.phone || "",
          expiresIn: OTP_EXPIRY_MS / 1000,
          resendCooldown: 60,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile rider forgot-password send-otp error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
