import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Define request body interface
interface ProductSellerRegisterRequest {
  name?: string
  email: string
  password: string
  phone?: string
  phoneCountryCode?: string
}

// Define user response type
interface UserResponse {
  id: string
  email: string
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
    email: string
    name: string | null
    role: UserRole
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
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: ProductSellerRegisterRequest
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

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email and password are required" 
        },
        { status: 400 }
      )
    }

    // Validate email format
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

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Password must be at least 6 characters long" 
        },
        { status: 400 }
      )
    }

    // Check existing user
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Generate OTP
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    // Create user with SELLER_PRODUCT role
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() ?? null,
        password: hashedPassword,
        role: UserRole.SELLER_PRODUCT,
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

    // Create seller record
    try {
      await prisma.seller.create({ 
        data: { 
          userId: user.id, 
          type: "PRODUCT" 
        } 
      })
    } catch (sellerError) {
      // If seller creation fails, delete the user to maintain data consistency
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

    // Send OTP email
    try {
      await sendVerificationOtpEmail({
        to: email,
        otp: verifyEmailOtp,
        name: name ?? null,
      })
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Still return success but note email failure
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
            verifyUrl: "/mobileapi/product-seller/verify-otp"
          }
        },
        { status: 201 }
      )
    }

    // Return success response
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
            expiresIn: OTP_EXPIRY_MS / 1000, // in seconds
            resendCooldown: 60, // 60 seconds cooldown for resend
          },
          verifyUrl: "/mobileapi/product-seller/verify-otp"
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Mobile product seller registration error:", error)
    
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