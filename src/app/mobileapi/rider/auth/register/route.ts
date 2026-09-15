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
  email?: string
  password: string
  phone: string
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

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      )
    }

    // Phone is REQUIRED
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Mobile number is required" },
        { status: 400 }
      )
    }

    const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
      ? phoneCountryCode.trim()
      : "+232"
    const validation = validatePhoneAndCountryCode(phone.trim(), code)
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error || "Invalid mobile number or country code" },
        { status: 400 }
      )
    }
    const normalizedPhone = validation.cleanedPhone!
    const normalizedPhoneCountryCode = validation.cleanedCountryCode!

    // Email is OPTIONAL
    const cleanEmail = typeof email === "string" && email.trim() ? email.toLowerCase().trim() : null
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: "Invalid email format" },
          { status: 400 }
        )
      }
    }

    const nameCheck = await checkDisallowedName(sanitizedName)
    if (!nameCheck.isAllowed) {
      return NextResponse.json(
        { success: false, error: nameCheck.error! },
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

    const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
    const existingPhone = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
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

    if (existingPhone) {
      if (existingPhone.isEmailVerified) {
        return NextResponse.json(
          { success: false, error: "An account with this mobile number is already registered. Please log in." },
          { status: 400 }
        )
      }

      // Ensure rider profile exists in riders table
      let rider = existingPhone.rider
      if (!rider) {
        rider = await prisma.rider.create({
          data: {
            userId: existingPhone.id,
            isApproved: false,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        })
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const verifyEmailOtp = randomInt(100000, 999999).toString()
      const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
      const now = new Date()

      await prisma.user.update({
        where: { id: existingPhone.id },
        data: {
          role: UserRole.RIDER,
          password: hashedPassword,
          name: sanitizedName || existingPhone.name,
          phone: normalizedPhone,
          phoneCountryCode: normalizedPhoneCountryCode,
          verifyEmailOtp,
          emailVerificationExpires,
          emailOtpSentAt: now,
          ...(cleanEmail ? { email: cleanEmail } : {}),
        },
      })

      const baseUrl = getAppBaseUrl(request)
      const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&phone=${encodeURIComponent(normalizedPhone)}`

      try {
        const sendPromises: Promise<any>[] = [
          sendEmailVerificationSms({
            to: normalizedPhone,
            countryCode: normalizedPhoneCountryCode,
            verificationLink,
            otp: verifyEmailOtp,
            name: sanitizedName || existingPhone.name,
          }),
        ]

        const targetEmail = cleanEmail || existingPhone.email
        if (targetEmail) {
          sendPromises.push(
            sendRiderVerificationEmail({
              to: targetEmail,
              name: sanitizedName || existingPhone.name || "Delivery Rider",
              verificationLink,
              otp: verifyEmailOtp,
            })
          )
        }

        await Promise.allSettled(sendPromises)
      } catch (sendError) {
        console.error("Failed to send rider verification email/sms on retry:", sendError)
      }

      return NextResponse.json(
        {
          success: true,
          message: cleanEmail
            ? "Registration successful. Please verify your account with the 6-digit OTP sent to your mobile number and email."
            : "Registration successful. Please verify your account with the 6-digit OTP sent to your mobile number.",
          data: {
            userId: existingPhone.id,
            riderId: rider.id ?? null,
            email: cleanEmail || existingPhone.email,
            phone: normalizedPhone,
            name: sanitizedName || existingPhone.name,
            role: UserRole.RIDER,
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
    }

    // Check if email already registered
    if (cleanEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail },
      })
      if (existingEmail && existingEmail.isEmailVerified) {
        return NextResponse.json(
          { success: false, error: "An account with this email is already registered. Please log in." },
          { status: 400 }
        )
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
        role: UserRole.RIDER,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
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
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        rider: {
          select: {
            id: true,
            status: true,
            onboardingCompleted: true,
            isApproved: true,
          },
        },
      },
    })

    if (!user.rider?.id) {
      const healedRider = await prisma.rider.findUnique({ where: { userId: user.id } })
      if (!healedRider) {
        console.error(`Rider row missing after user.create for userId=${user.id}`)
        throw new Error("Rider profile could not be created. Please try again.")
      }
      ;(user as any).rider = healedRider
    }

    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/riderapp/verify-email?token=${verifyEmailOtp}&phone=${encodeURIComponent(normalizedPhone)}`

    try {
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
          sendRiderVerificationEmail({
            to: cleanEmail,
            name: sanitizedName || "Delivery Rider",
            verificationLink,
            otp: verifyEmailOtp,
          })
        )
      }

      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to send rider verification email/sms:", sendError)
    }

    return NextResponse.json(
      {
        success: true,
        message: cleanEmail
          ? "Registration successful. Please verify your account with the 6-digit OTP sent to your mobile number and email."
          : "Registration successful. Please verify your account with the 6-digit OTP sent to your mobile number.",
        data: {
          userId: user.id,
          riderId: user.rider?.id ?? null,
          email: user.email,
          phone: user.phone,
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
  } catch (error: any) {
    console.error("Mobile rider registration error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error during registration." },
      { status: 500 }
    )
  }
}
