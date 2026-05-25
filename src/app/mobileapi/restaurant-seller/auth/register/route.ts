import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { activateRestaurantFreePlan } from "@/lib/subscriptions"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface RestaurantSellerRegisterRequest {
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
    otp?: string // Added for testing
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

    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Password must be at least 6 characters long" 
        },
        { status: 400 }
      )
    }

    if (phone) {
      const phoneRegex = /^[0-9]{10}$/
      if (!phoneRegex.test(phone)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid phone number format. Must be 10 digits." 
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
          error: "User with this email already exists",
          data: {
            email: email
          }
        },
        { status: 400 }
      )
    }

    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: phone.trim() }
      })
      if (existingPhone) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "User with this phone number already exists"
          },
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
        email: email.toLowerCase().trim(),
        name: name?.trim() ?? null,
        password: hashedPassword,
        role: UserRole.SELLER_RESTAURANT,
        phone: phone?.trim() ?? null,
        phoneCountryCode: phoneCountryCode?.trim() ?? null,
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

    try {
      await sendVerificationOtpEmail({
        to: email,
        otp: verifyEmailOtp,
        name: name ?? null,
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
            verifyUrl: "/mobileapi/restaurant-seller/verify-otp",
            otp: verifyEmailOtp
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
          verifyUrl: "/mobileapi/restaurant-seller/verify-otp",
          otp: verifyEmailOtp
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
