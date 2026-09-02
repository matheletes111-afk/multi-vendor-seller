import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { validatePhoneAndCountryCode, getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { sendRiderVerificationEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, phoneCountryCode, password } = body

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Validate phone & country code if provided
    let cleanedPhone: string | null = null
    let cleanedCountryCode: string | null = null

    const hasPhone = typeof phone === "string" && phone.trim().length > 0
    if (hasPhone) {
      const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
        ? phoneCountryCode.trim()
        : "+232"
      const phoneValidation = validatePhoneAndCountryCode(phone.trim(), code)
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || "Invalid phone number or country code" },
          { status: 400 }
        )
      }
      cleanedPhone = phoneValidation.cleanedPhone || null
      cleanedCountryCode = phoneValidation.cleanedCountryCode || null

      if (cleanedPhone) {
        const phoneVariants = getEquivalentPhoneVariants(cleanedPhone, cleanedCountryCode)
        const existingPhone = await prisma.user.findFirst({
          where: { phone: { in: phoneVariants } },
        })
        if (existingPhone) {
          return NextResponse.json(
            { error: "An account with this phone number already exists" },
            { status: 400 }
          )
        }
      }
    }

    // Check if email already exists
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
      },
    })

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in." },
          { status: 400 }
        )
      }

      // User exists but is not verified: refresh 6-digit OTP and resend email
      const verifyEmailOtp = crypto.randomInt(100000, 999999).toString()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          verifyEmailOtp,
          emailVerificationExpires: expiresAt,
          emailOtpSentAt: new Date(),
        },
      })

      const origin = new URL(request.url).origin
      const verificationLink = `${origin}/riderapp/verify-email?token=${verifyEmailOtp}&email=${encodeURIComponent(cleanEmail)}`

      try {
        const emailPromise = sendRiderVerificationEmail({
          to: cleanEmail,
          name: existingUser.name || name.trim(),
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

      return NextResponse.json({
        success: true,
        message: "Registration already in progress. A fresh verification code has been sent to your email.",
        email: cleanEmail,
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const verifyEmailOtp = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        phone: cleanedPhone,
        phoneCountryCode: cleanedCountryCode,
        role: UserRole.RIDER,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires: expiresAt,
        emailOtpSentAt: new Date(),
        rider: {
          create: {
            isApproved: true,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        },
      },
    })

    const origin = new URL(request.url).origin
    const verificationLink = `${origin}/riderapp/verify-email?token=${verifyEmailOtp}&email=${encodeURIComponent(cleanEmail)}`

    // Send verification email & SMS
    try {
      const emailPromise = sendRiderVerificationEmail({
        to: cleanEmail,
        name: name.trim(),
        verificationLink,
        otp: verifyEmailOtp,
      })
      const smsPromise = cleanedPhone
        ? sendEmailVerificationSms({
            to: cleanedPhone,
            countryCode: cleanedCountryCode,
            verificationLink,
            otp: verifyEmailOtp,
            name: name.trim(),
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

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      email: cleanEmail,
    })
  } catch (error) {
    console.error("Rider registration error:", error)
    return NextResponse.json(
      { error: "An error occurred during registration. Please try again." },
      { status: 500 }
    )
  }
}
