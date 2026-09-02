import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendRiderVerificationEmail } from "@/lib/email"
import { validatePhoneAndCountryCode, getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { checkDisallowedName } from "@/lib/name-validation"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface RiderRegisterRequest {
  name?: string
  email: string
  password: string
  phone?: string
  phoneCountryCode?: string
}

export async function POST(request: Request) {
  try {
    let body: RiderRegisterRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const { name, email, password, phone, phoneCountryCode } = body
    const sanitizedName = name ? sanitizeInput(name) : null

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      )
    }

    const nameCheck = await checkDisallowedName(sanitizedName)
    if (!nameCheck.isAllowed) {
      return NextResponse.json(
        { success: false, error: nameCheck.error! },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error! },
        { status: 400 }
      )
    }

    let normalizedPhone: string | null = null
    let normalizedPhoneCountryCode: string | null = null

    const hasPhone = typeof phone === "string" && phone.trim().length > 0
    if (hasPhone) {
      const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
        ? phoneCountryCode.trim()
        : "+232"
      const validation = validatePhoneAndCountryCode(phone.trim(), code)
      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.error! },
          { status: 400 }
        )
      }
      normalizedPhone = validation.cleanedPhone!
      normalizedPhoneCountryCode = validation.cleanedCountryCode!

      const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
      const existingPhone = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
      })
      if (existingPhone) {
        return NextResponse.json(
          { success: false, error: "Phone number is already registered" },
          { status: 400 }
        )
      }
    }

    const cleanEmail = email.toLowerCase().trim()
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        role: true,
        rider: true,
      },
    })

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return NextResponse.json(
          { success: false, error: "An account with this email is already registered. Please log in." },
          { status: 400 }
        )
      }

      // Rider exists but email is not yet verified (e.g. retrying registration): Resend fresh 6-digit OTP
      const verifyEmailOtp = randomInt(100000, 999999).toString()
      const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
      const now = new Date()

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          verifyEmailOtp,
          emailVerificationExpires,
          emailOtpSentAt: now,
        },
      })

      const baseUrl = getAppBaseUrl(request)
      const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&email=${encodeURIComponent(cleanEmail)}`

      try {
        const emailPromise = sendRiderVerificationEmail({
          to: cleanEmail,
          name: existingUser.name || sanitizedName || "Delivery Rider",
          verificationLink,
          otp: verifyEmailOtp,
        })
        const smsPromise = existingUser.phone
          ? sendEmailVerificationSms({
              to: existingUser.phone,
              countryCode: existingUser.phoneCountryCode,
              verificationLink,
              otp: verifyEmailOtp,
              name: existingUser.name,
            })
          : Promise.resolve()

        const [emailRes] = await Promise.allSettled([emailPromise, smsPromise])
        if (emailRes.status === "rejected") {
          console.error("Failed to send rider verification email (rejected):", emailRes.reason)
        } else if (emailRes.status === "fulfilled" && !(emailRes.value as any)?.success) {
          console.error("Failed to send rider verification email:", (emailRes.value as any)?.error)
        }
      } catch (sendError) {
        console.error("Failed to send rider verification email/sms on retry:", sendError)
      }

      return NextResponse.json(
        {
          success: true,
          message: "Registration already in progress. A fresh 6-digit OTP has been sent to your email.",
          data: {
            userId: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role,
            requiresVerification: true,
            verificationDetails: {
              method: "OTP",
              expiresIn: OTP_EXPIRY_MS / 1000,
              resendCooldown: 60,
            },
            verifyUrl: "/mobileapi/rider/auth/verify-otp",
          },
        },
        { status: 200 }
      )
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
        role: UserRole.RIDER,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
        rider: {
          create: {
            isApproved: true,
            isSuspended: false,
            status: "APPROVED",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&email=${encodeURIComponent(cleanEmail)}`

    try {
      const emailPromise = sendRiderVerificationEmail({
        to: cleanEmail,
        name: sanitizedName || "Delivery Rider",
        verificationLink,
        otp: verifyEmailOtp,
      })
      const smsPromise = normalizedPhone
        ? sendEmailVerificationSms({
            to: normalizedPhone,
            countryCode: normalizedPhoneCountryCode,
            verificationLink,
            otp: verifyEmailOtp,
            name: sanitizedName,
          })
        : Promise.resolve()

      const [emailRes] = await Promise.allSettled([emailPromise, smsPromise])
      if (emailRes.status === "rejected") {
        console.error("Failed to send rider verification email (rejected):", emailRes.reason)
      } else if (emailRes.status === "fulfilled" && !(emailRes.value as any)?.success) {
        console.error("Failed to send rider verification email:", (emailRes.value as any)?.error)
      }
    } catch (sendError) {
      console.error("Failed to send rider verification email/sms:", sendError)
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please verify your email with the 6-digit OTP sent.",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          requiresVerification: true,
          verificationDetails: {
            method: "OTP",
            expiresIn: OTP_EXPIRY_MS / 1000,
            resendCooldown: 60,
          },
          verifyUrl: "/mobileapi/rider/auth/verify-otp",
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Mobile rider registration error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during registration." },
      { status: 500 }
    )
  }
}
