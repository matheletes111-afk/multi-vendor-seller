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

    if (!name?.trim() || !password) {
      return NextResponse.json(
        { error: "Name and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // Phone is REQUIRED
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { error: "Mobile number is required" },
        { status: 400 }
      )
    }

    const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
      ? phoneCountryCode.trim()
      : "+232"
    const phoneValidation = validatePhoneAndCountryCode(phone.trim(), code)
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || "Invalid mobile number or country code" },
        { status: 400 }
      )
    }
    const cleanedPhone = phoneValidation.cleanedPhone!
    const cleanedCountryCode = phoneValidation.cleanedCountryCode!

    // Email is OPTIONAL
    const cleanEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        )
      }
    }

    const phoneVariants = getEquivalentPhoneVariants(cleanedPhone, cleanedCountryCode)

    // Check if user already exists with this phone
    const existingPhoneUser = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
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

    if (existingPhoneUser) {
      if (existingPhoneUser.isEmailVerified) {
        return NextResponse.json(
          { error: "An account with this mobile number already exists. Please log in." },
          { status: 400 }
        )
      }

      // Existing unverified user: refresh OTP and resend
      const existingRider = await prisma.rider.findUnique({ where: { userId: existingPhoneUser.id } })
      if (!existingRider) {
        await prisma.rider.create({
          data: {
            userId: existingPhoneUser.id,
            isApproved: false,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        })
      }

      const verifyEmailOtp = crypto.randomInt(100000, 999999).toString()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: existingPhoneUser.id },
        data: {
          verifyEmailOtp,
          emailVerificationExpires: expiresAt,
          emailOtpSentAt: new Date(),
          ...(cleanEmail ? { email: cleanEmail } : {}),
        },
      })

      const baseUrl = getAppBaseUrl(request)
      const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&phone=${encodeURIComponent(cleanedPhone)}`

      const targetEmail = cleanEmail || existingPhoneUser.email

      try {
        const sendPromises: Promise<any>[] = [
          sendEmailVerificationSms({
            to: existingPhoneUser.phone || cleanedPhone,
            countryCode: existingPhoneUser.phoneCountryCode || cleanedCountryCode,
            verificationLink,
            otp: verifyEmailOtp,
            name: existingPhoneUser.name,
          }),
        ]

        if (targetEmail) {
          sendPromises.push(
            sendRiderVerificationEmail({
              to: targetEmail,
              name: existingPhoneUser.name || name.trim(),
              verificationLink,
              otp: verifyEmailOtp,
            })
          )
        }

        await Promise.allSettled(sendPromises)
      } catch (sendError) {
        console.error("Failed to resend rider verification email/sms on retry:", sendError)
      }

      return NextResponse.json({
        success: true,
        message: targetEmail
          ? "Registration already in progress. A fresh verification code has been sent to your mobile number and email."
          : "Registration already in progress. A fresh verification code has been sent to your mobile number via SMS.",
        phone: cleanedPhone,
        email: targetEmail || null,
      })
    }

    // If email provided, check if email already exists
    if (cleanEmail) {
      const existingEmailUser = await prisma.user.findUnique({
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

      if (existingEmailUser) {
        if (existingEmailUser.isEmailVerified) {
          return NextResponse.json(
            { error: "An account with this email already exists. Please log in." },
            { status: 400 }
          )
        }
      }
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
            isApproved: false,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        },
      },
    })

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&phone=${encodeURIComponent(cleanedPhone)}`

    // Send verification SMS & Email (if email provided)
    try {
      const sendPromises: Promise<any>[] = [
        sendEmailVerificationSms({
          to: cleanedPhone,
          countryCode: cleanedCountryCode,
          verificationLink,
          otp: verifyEmailOtp,
          name: name.trim(),
        }),
      ]

      if (cleanEmail) {
        sendPromises.push(
          sendRiderVerificationEmail({
            to: cleanEmail,
            name: name.trim(),
            verificationLink,
            otp: verifyEmailOtp,
          })
        )
      }

      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to send rider verification email/sms:", sendError)
    }

    return NextResponse.json({
      success: true,
      message: cleanEmail
        ? "Registration successful. Please check your mobile SMS or email to verify your account."
        : "Registration successful. Please check your mobile SMS for the verification code.",
      phone: cleanedPhone,
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
