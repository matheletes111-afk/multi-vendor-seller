import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateRestaurantFreePlan } from "@/lib/subscriptions"
import { validatePhoneAndCountryCode, getEquivalentPhoneVariants } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface RestaurantSellerRegisterRequest {
  name?: string
  email?: string
  password: string
  phone: string
  phoneCountryCode?: string
}

interface UserResponse {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  role: UserRole
}

interface VerificationDetails {
  method: "OTP"
  expiresIn: number
  resendCooldown: number
}

interface SuccessResponse {
  success: true
  message: string
  data: {
    userId: string
    email: string | null
    phone: string | null
    name: string | null
    role: UserRole
    sellerType: string
    requiresVerification: true
    verificationDetails: VerificationDetails
    verifyUrl: string
  }
}

interface ErrorResponse {
  success: false
  error: string
  data?: {
    email?: string
    phone?: string
  }
}

import { checkDisallowedName } from "@/lib/name-validation"

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    let body: RestaurantSellerRegisterRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid JSON payload" 
        },
        { status: 400 }
      )
    }

    const { name, email, password, phone, phoneCountryCode } = body

    if (!password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Password is required" 
        },
        { status: 400 }
      )
    }

    const nameCheck = await checkDisallowedName(name)
    if (!nameCheck.isAllowed) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: nameCheck.error!
        },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: passwordValidation.error!
        },
        { status: 400 }
      )
    }

    // Phone is required
    const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
      ? phoneCountryCode.trim()
      : "+232"
    const validation = validatePhoneAndCountryCode(phone || "", code)
    if (!validation.isValid) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: validation.error || "A valid mobile phone number is required"
        },
        { status: 400 }
      )
    }
    const normalizedPhone = validation.cleanedPhone!
    const normalizedPhoneCountryCode = validation.cleanedCountryCode!

    // Email is optional: validate if provided
    let normalizedEmail: string | null = null
    if (email && typeof email === "string" && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const cleanEmail = email.trim().toLowerCase()
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid email format" 
          },
          { status: 400 }
        )
      }
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail }
      })
      if (existingEmail) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Email or mobile number is already registered"
          },
          { status: 400 }
        )
      }
      normalizedEmail = cleanEmail
    }

    const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
    const existingPhone = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } }
    })
    if (existingPhone) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email or mobile number is already registered"
        },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    const sanitizedName = name ? sanitizeInput(name) : null

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: sanitizedName,
        password: hashedPassword,
        role: UserRole.SELLER_RESTAURANT,
        phone: normalizedPhone,
        phoneCountryCode: normalizedPhoneCountryCode,
        isEmailVerified: false,
        verifyEmailOtp,
        emailVerificationExpires,
        emailOtpSentAt: now,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
      }
    }) as UserResponse

    try {
      const restaurantSeller = await prisma.restaurantSeller.create({ 
        data: { 
          userId: user.id
        } 
      })
      await activateRestaurantFreePlan(restaurantSeller.id)
    } catch (sellerError) {
      await prisma.user.delete({ where: { id: user.id } })
      console.error("Restaurant Seller creation failed:", sellerError)
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Failed to create restaurant seller account" 
        },
        { status: 500 }
      )
    }

    // Send OTP email & SMS
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

    if (normalizedEmail) {
      sendPromises.push(
        sendVerificationOtpEmail({
          to: normalizedEmail,
          otp: verifyEmailOtp,
          name: sanitizedName,
          verificationLink,
        })
      )
    }

    try {
      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to send verification email/SMS:", sendError)
    }

    const message = normalizedEmail
      ? "Please verify your account with the OTP sent to your email and mobile."
      : "Please verify your account with the OTP sent to your mobile number."

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message,
        data: {
          userId: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          role: user.role,
          sellerType: "restaurant",
          requiresVerification: true,
          verificationDetails: {
            method: "OTP",
            expiresIn: OTP_EXPIRY_MS / 1000,
            resendCooldown: 60,
          },
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Mobile restaurant seller registration error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}
