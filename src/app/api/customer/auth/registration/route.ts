import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { validatePhoneAndCountryCode, getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"
import { checkDisallowedName } from "@/lib/name-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 min

/** POST /api/customer/auth/registration — Customer panel registration. */

/** POST /api/customer/auth/registration — Customer panel registration. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, phone, phoneCountryCode } = body
    const sanitizedName = name ? sanitizeInput(name) : null

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    // Phone is REQUIRED
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 })
    }

    const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
      ? phoneCountryCode.trim()
      : "+232"
    const validation = validatePhoneAndCountryCode(phone.trim(), code)
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error || "Invalid mobile number or country code" }, { status: 400 })
    }
    const normalizedPhone = validation.cleanedPhone!
    const normalizedPhoneCountryCode = validation.cleanedCountryCode!

    // Email is OPTIONAL
    const cleanEmail = typeof email === "string" && email.trim() ? email.toLowerCase().trim() : null
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
      }
    }

    const nameCheck = await checkDisallowedName(sanitizedName)
    if (!nameCheck.isAllowed) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400 })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 })
    }

    const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
    const existingPhone = await prisma.user.findFirst({ where: { phone: { in: phoneVariants } } })
    if (existingPhone) {
      return NextResponse.json({ error: "Mobile number is already registered" }, { status: 400 })
    }

    if (cleanEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } })
      if (existingUser) {
        return NextResponse.json({ error: "Email is already registered" }, { status: 400 })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: sanitizedName,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
    })

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${verifyEmailOtp}`

    const sendPromises: Promise<any>[] = [
      sendEmailVerificationSms({
        to: normalizedPhone,
        countryCode: normalizedPhoneCountryCode,
        verificationLink,
        otp: verifyEmailOtp,
        name: sanitizedName,
      }),
    ]

    if (cleanEmail) {
      sendPromises.push(
        sendVerificationOtpEmail({
          to: cleanEmail,
          otp: verifyEmailOtp,
          name: sanitizedName,
          verificationLink,
        })
      )
    }

    await Promise.allSettled(sendPromises)

    const verifyParam = cleanEmail ? `email=${encodeURIComponent(cleanEmail)}` : `phone=${encodeURIComponent(normalizedPhone)}`
    return NextResponse.json({
      message: cleanEmail
        ? "Please verify your account with the OTP sent to your email and mobile SMS."
        : "Please verify your mobile number with the SMS OTP sent.",
      userId: user.id,
      phone: normalizedPhone,
      email: cleanEmail,
      verifyUrl: `/customer/verify-otp?${verifyParam}`,
    }, { status: 201 })
  } catch (error) {
    console.error("Customer registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
