import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Define request body interface
interface RegisterRequest {
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
}

// Define success response type (matching login pattern)
interface SuccessResponse {
  success: true
  message: string
  data: {
    userId: string
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
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse and validate request body
    const body: RegisterRequest = await request.json()
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

    // Validate password strength (optional - adjust as needed)
    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Password must be at least 6 characters long" 
        },
        { status: 400 }
      )
    }

    // Check if user already exists
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

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() ?? null,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
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
      }
    })

    // Send verification email
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
            verifyUrl: "/mobileapi/customer/verify-otp",
            user
          }
        },
        { status: 201 }
      )
    }

    // Return success response (matching login pattern)
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Please verify your email with the OTP sent.",
        data: {
          userId: user.id,
          verifyUrl: "/mobileapi/customer/verify-otp",
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