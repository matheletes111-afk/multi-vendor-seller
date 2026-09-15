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
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Define request body interface
interface ServiceSellerRegisterRequest {
  name?: string
  email?: string
  password: string
  phone: string
  phoneCountryCode?: string
}

// Define user response type
interface UserResponse {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  role: UserRole
}

// Define verification details type
interface VerificationDetails {
  method: "OTP"
  expiresIn: number
  resendCooldown: number
}

// Define success response type
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

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  data?: {
    email?: string
    phone?: string
  }
}

import { checkDisallowedName } from "@/lib/name-validation"

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: ServiceSellerRegisterRequest
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
    const sanitizedName = name ? sanitizeInput(name) : null

    // Validate required fields
    if (!password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Password is required" 
        },
        { status: 400 }
      )
    }

    const nameCheck = await checkDisallowedName(sanitizedName)
    if (!nameCheck.isAllowed) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: nameCheck.error!
        },
        { status: 400 }
      )
    }

    // Validate password strength
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
    const validation = validatePhoneAndCountryCode(phone || "", phoneCountryCode || "")
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Generate OTP
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    // Create user with SELLER_SERVICE role
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
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
      }
    }) as UserResponse

    // Create seller record with SERVICE type
    try {
      const seller = await prisma.seller.create({ 
        data: { 
          userId: user.id, 
          type: "SERVICE" 
        } 
      })
      await activateFreePlan(seller.id)
    } catch (sellerError) {
      await prisma.user.delete({ where: { id: user.id } })
      
      console.error("Seller creation failed:", sellerError)
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Failed to create seller account" 
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

    // Return success response
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
          sellerType: "service",
          requiresVerification: true,
          verificationDetails: {
            method: "OTP",
            expiresIn: OTP_EXPIRY_MS / 1000, // in seconds
            resendCooldown: 60, // 60 seconds cooldown for resend
          },
          verifyUrl: "/mobileapi/service-seller/auth/verify-otp"
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Mobile service seller registration error:", error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("prisma")) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Database error occurred" 
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}