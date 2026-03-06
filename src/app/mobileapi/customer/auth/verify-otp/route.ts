import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"

// Define request body interface
interface VerifyOtpRequest {
  email: string
  otp: string
  deviceId?: string
  platform?: string
}

// Define user type for response (matches our select shapes)
type UserWithoutOtp = {
  id: string
  email: string
  name: string | null
  role: UserRole
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// Define token response type
interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// Define success response type
interface SuccessResponse {
  success: true
  message: string
  data: {
    user: UserWithoutOtp
    tokens?: TokenResponse
  }
}

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  expired?: boolean
  data?: {
    email?: string
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: VerifyOtpRequest
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

    // Extract and validate fields
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const { deviceId, platform } = body

    // Validation
    if (!email || !otp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email and OTP are required" 
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

    // Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/
    if (!otpRegex.test(otp)) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "OTP must be 6 digits" 
        },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: UserRole.CUSTOMER 
      },
      select: { 
        id: true, 
        email: true,
        name: true,
        role: true,
        phone: true,
        phoneCountryCode: true,
        verifyEmailOtp: true, 
        emailVerificationExpires: true, 
        emailOtpSentAt: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        password: true // Include password for token generation if needed
      },
    })

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or OTP." 
        },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.isEmailVerified) {
      // Generate tokens for already verified user
      const tokens = generateMobileTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
      })

      // Remove sensitive data
      const { verifyEmailOtp, emailVerificationExpires, emailOtpSentAt, password, ...userData } = user

      return NextResponse.json<SuccessResponse>(
        { 
          success: true,
          message: "Email already verified.",
          data: {
            user: userData,
            tokens
          }
        },
        { status: 200 }
      )
    }

    // Verify OTP exists
    if (!user.verifyEmailOtp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "No OTP found. Please request a new one.",
          expired: true
        },
        { status: 400 }
      )
    }

    // Verify OTP
    if (user.verifyEmailOtp !== otp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid OTP." 
        },
        { status: 400 }
      )
    }

    // Check OTP expiry
    const now = new Date()
    if (!user.emailVerificationExpires || user.emailVerificationExpires < now) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "OTP has expired. Please request a new one.",
          expired: true
        },
        { status: 400 }
      )
    }

    // Update user as verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        isEmailVerified: true, 
        verifyEmailOtp: null, 
        emailVerificationExpires: null, 
        emailOtpSentAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        phoneCountryCode: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    // Generate JWT tokens
    const normalizedPlatform =
      platform === "ios" || platform === "android" || platform === "web" ? platform : undefined
    const tokens = generateMobileTokens({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      deviceId: deviceId || undefined,
      platform: normalizedPlatform,
    })

    // Return success with user details and tokens
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Email verified successfully.",
        data: {
          user: updatedUser,
          tokens
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile verify-otp error:", error)
    
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