import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateHotelFreePlan } from "@/lib/subscriptions"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sanitizeInput } from "@/lib/html-sanitization"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface HotelSellerRegisterRequest {
  name?: string
  email: string
  password: string
  phone?: string
  phoneCountryCode?: string
}

interface UserResponse {
  id: string
  email: string
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
    email: string
    name: string | null
    role: UserRole
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
  }
}

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    let body: HotelSellerRegisterRequest
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

    if (!email || !password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email and password are required" 
        },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email format" 
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

    let normalizedPhone: string | null = null
    let normalizedPhoneCountryCode: string | null = null

    if (phone || phoneCountryCode) {
      const validation = validatePhoneAndCountryCode(phone || "", phoneCountryCode || "")
      if (!validation.isValid) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: validation.error!
          },
          { status: 400 }
        )
      }
      normalizedPhone = validation.cleanedPhone!
      normalizedPhoneCountryCode = validation.cleanedCountryCode!

      const existingPhone = await prisma.user.findFirst({
        where: { phone: normalizedPhone }
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
    }

    const existingUser = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase().trim() } 
    })

    if (existingUser) {
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
        email: email.toLowerCase().trim(),
        name: sanitizedName,
        password: hashedPassword,
        role: UserRole.SELLER_HOTEL,
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
        name: true,
        role: true,
      }
    }) as UserResponse

    try {
      const hotelSeller = await prisma.hotelSeller.create({ 
        data: { 
          userId: user.id
        } 
      })
      await activateHotelFreePlan(hotelSeller.id)
    } catch (sellerError) {
      await prisma.user.delete({ where: { id: user.id } })
      console.error("Hotel Seller creation failed:", sellerError)
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Failed to create hotel seller account" 
        },
        { status: 500 }
      )
    }

    try {
      await sendVerificationOtpEmail({
        to: email,
        otp: verifyEmailOtp,
        name: sanitizedName,
      })
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      return NextResponse.json<SuccessResponse>(
        { 
          success: true,
          message: "Registration successful but failed to send verification email. Please contact support.",
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
            verifyUrl: "/mobileapi/hotel-seller/auth/verify-otp"
          }
        },
        { status: 201 }
      )
    }

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Please verify your email with the OTP sent.",
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
          verifyUrl: "/mobileapi/hotel-seller/auth/verify-otp"
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Mobile hotel seller registration error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}
