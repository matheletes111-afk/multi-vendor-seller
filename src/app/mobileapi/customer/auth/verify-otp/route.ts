import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

// Define request body interface
interface VerifyOtpRequest {
  email?: string
  phone?: string
  phoneCountryCode?: string
  otp: string
  deviceId?: string
  platform?: string
}

// Define user type for response (matches our select shapes)
type UserWithoutOtp = {
  id: string
  email: string | null
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
    phone?: string
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
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""
    const { deviceId, platform } = body

    // Validation
    if ((!email && !phone) || !otp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Mobile number or email and OTP are required" 
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
    let user: any = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { 
          email,
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
          password: true // Include password for token generation
        },
      })
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { 
          phone: { in: phoneVariants },
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
          password: true
        },
      })
    }

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid credentials or OTP." 
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
        phone: user.phone,
        role: user.role,
        passwordHash: user.password,
      })

      // Remove sensitive data
      const { verifyEmailOtp, emailVerificationExpires, emailOtpSentAt, password, ...userData } = user

      return NextResponse.json<SuccessResponse>(
        { 
          success: true,
          message: "Account already verified.",
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
        password: true,
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
      phone: updatedUser.phone,
      role: updatedUser.role,
      deviceId: deviceId || undefined,
      platform: normalizedPlatform,
      passwordHash: updatedUser.password,
    })

    // Return success with user details and tokens (strip password hash)
    const { password: _password, ...safeUser } = updatedUser
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Account verified successfully.",
        data: {
          user: safeUser,
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