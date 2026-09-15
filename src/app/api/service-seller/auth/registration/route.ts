import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateFreePlan } from "@/lib/subscriptions"
import { validatePhoneAndCountryCode, getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { checkDisallowedName } from "@/lib/name-validation"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 min

/** POST /api/service-seller/auth/registration — Service seller panel registration. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, phone, phoneCountryCode } = body
    const sanitizedName = name ? sanitizeInput(name) : null

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    const nameCheck = await checkDisallowedName(sanitizedName)
    if (!nameCheck.isAllowed) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400 })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
    }

    // Mobile number is required
    const validation = validatePhoneAndCountryCode(phone, phoneCountryCode)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error || "A valid mobile phone number is required" }, { status: 400 })
    }
    const normalizedPhone = validation.cleanedPhone!
    const normalizedPhoneCountryCode = validation.cleanedCountryCode!

    // Email is optional: validate only if provided
    let normalizedEmail: string | null = null
    if (email && typeof email === "string" && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const trimmedEmail = email.trim().toLowerCase()
      if (!emailRegex.test(trimmedEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
      }
      const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } })
      if (existingUser) {
        return NextResponse.json({ error: "Email or mobile number is already registered" }, { status: 400 })
      }
      normalizedEmail = trimmedEmail
    }

    const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
    const existingPhone = await prisma.user.findFirst({ where: { phone: { in: phoneVariants } } })
    if (existingPhone) {
      return NextResponse.json({ error: "Email or mobile number is already registered" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: sanitizedName,
        password: hashedPassword,
        role: UserRole.SELLER_SERVICE,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
    })
    const seller = await prisma.seller.create({ data: { userId: user.id, type: "SERVICE" } })
    await activateFreePlan(seller.id)

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${verifyEmailOtp}`

    const notificationPromises: Promise<any>[] = [
      sendEmailVerificationSms({
        to: normalizedPhone,
        countryCode: normalizedPhoneCountryCode,
        verificationLink,
        otp: verifyEmailOtp,
        name: sanitizedName,
      }),
    ]

    if (normalizedEmail) {
      notificationPromises.push(
        sendVerificationOtpEmail({
          to: normalizedEmail,
          otp: verifyEmailOtp,
          name: sanitizedName,
          verificationLink,
        })
      )
    }

    await Promise.allSettled(notificationPromises)

    const message = normalizedEmail
      ? "Please verify your account with the OTP sent to your email and mobile number."
      : "Please verify your account with the OTP sent to your mobile number."

    const verifyParam = normalizedEmail ? `email=${encodeURIComponent(normalizedEmail)}` : `phone=${encodeURIComponent(normalizedPhone)}`

    return NextResponse.json(
      {
        message,
        userId: user.id,
        phone: normalizedPhone,
        verifyUrl: `/service-seller/verify-otp?${verifyParam}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Service seller registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
