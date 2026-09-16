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

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Define request body interface
interface RegisterRequest {
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
}

// Define success response type (matching login pattern)
interface SuccessResponse {
  success: true
  message: string
  data: {
    userId: string
    email?: string | null
    phone?: string | null
    isEmailVerified?: boolean
    isPhoneVerified?: boolean
    expiresIn?: number
    resendCooldown?: number
    verifyUrl: string
    user?: UserResponse
  }
}

// Define error response type (matching login pattern)
interface ErrorResponse {
  success: false
  error: string
  needsVerification?: boolean
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
    // Parse and validate request body
    const body: RegisterRequest = await request.json()
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

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Mobile number is required" 
        },
        { status: 400 }
      )
    }

    const code = typeof phoneCountryCode === "string" && phoneCountryCode.trim().length > 0
      ? phoneCountryCode.trim()
      : "+232"
    const validation = validatePhoneAndCountryCode(phone.trim(), code)
    if (!validation.isValid) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: validation.error || "Invalid mobile number or country code"
        },
        { status: 400 }
      )
    }
    const normalizedPhone = validation.cleanedPhone!
    const normalizedPhoneCountryCode = validation.cleanedCountryCode!

    // Email is optional
    const cleanEmail = typeof email === "string" && email.trim() ? email.toLowerCase().trim() : null
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid email format" 
          },
          { status: 400 }
        )
      }
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

    const phoneVariants = getEquivalentPhoneVariants(normalizedPhone, normalizedPhoneCountryCode)
    const existingPhone = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } }
    })
    if (existingPhone) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: "Mobile number is already registered"
        },
        { status: 400 }
      )
    }

    if (cleanEmail) {
      const existingUser = await prisma.user.findUnique({ 
        where: { email: cleanEmail } 
      })

      if (existingUser) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Email is already registered"
          },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Generate OTP
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    // Create user in database
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
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        isEmailVerified: true,
      }
    })

    // Send verification SMS & email
    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${verifyEmailOtp}`

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
          sendVerificationOtpEmail({
            to: cleanEmail,
            otp: verifyEmailOtp,
            name: sanitizedName,
            verificationLink,
          })
        )
      }

      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to send verification email/SMS:", sendError)
    }

    // Return success response (matching login pattern)
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: cleanEmail
          ? "Please verify your account with the OTP sent to your email and mobile SMS."
          : "Please verify your mobile number with the SMS OTP sent.",
        data: {
          userId: user.id,
          email: user.email,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: false,
          expiresIn: 600,
          resendCooldown: 60,
          verifyUrl: "/mobileapi/customer/auth/verify-otp",
          user
        }
      },
      { status: 201 }
    )

  } catch (error) {
    // Log error for debugging
    console.error("Mobile registration error:", error)
    
    // Check for specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid request format" 
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes("prisma")) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Database error occurred" 
        },
        { status: 500 }
      )
    }

    // Generic error response
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}