import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

// Define request body interface
interface ServiceSellerLoginRequest {
  email?: string
  phone?: string
  identifier?: string
  password: string
  phoneCountryCode?: string
  deviceId?: string
  platform?: string
}

// Define seller info type from the select query
interface SellerInfo {
  isApproved: boolean
  isSuspended: boolean
  onboardingCompleted: boolean
  onboardingStep: number
  mobileStep: number
  type: string | null
}

// Define user with seller type
interface UserWithSeller {
  id: string
  email: string | null
  name: string | null
  password: string
  role: UserRole
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  createdAt: Date
  updatedAt: Date
  seller: SellerInfo | null
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
    user: Omit<UserWithSeller, 'password' | 'seller'> & { sellerInfo: SellerInfo | null; sellerType: string }
    tokens: TokenResponse
    sessionInfo: {
      expiresIn: number
      tokenType: "Bearer"
    }
  }
}

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  needsVerification?: boolean
  needsApproval?: boolean
  isSuspended?: boolean
  approvalStatus?: string
  authStatus?: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED"
  verifyUrl?: string
  data?: {
    email?: string | null
    phone?: string | null
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Parse request body with error handling
    let body: Partial<ServiceSellerLoginRequest>
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

    const identifier = (body.identifier || body.email || body.phone || "").trim()
    const password = (body.password || "").trim()
    const phoneCountryCode = (body.phoneCountryCode || "").trim()

    // Validation
    if (!identifier || !password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email or mobile number, and password are required" 
        },
        { status: 400 }
      )
    }

    // Validate password
    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password" 
        },
        { status: 401 }
      )
    }

    let user: UserWithSeller | null = null

    if (identifier.includes("@")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(identifier)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid email format" 
          },
          { status: 400 }
        )
      }

      user = (await prisma.user.findFirst({
        where: { 
          email: identifier.toLowerCase().trim(),
          role: UserRole.SELLER_SERVICE
        },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          seller: {
            select: {
              isApproved: true,
              isSuspended: true,
              onboardingCompleted: true,
              onboardingStep: true,
              type: true
            }
          }
        }
      })) as UserWithSeller | null
    } else {
      const variants = getEquivalentPhoneVariants(identifier, phoneCountryCode)
      user = (await prisma.user.findFirst({
        where: { 
          role: UserRole.SELLER_SERVICE,
          OR: [
            { phone: { in: variants } },
            { phone: identifier }
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          seller: {
            select: {
              isApproved: true,
              isSuspended: true,
              onboardingCompleted: true,
              onboardingStep: true,
              type: true
            }
          }
        }
      })) as UserWithSeller | null
    }

    // Check if user exists
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password" 
        },
        { status: 401 }
      )
    }

    // Check if password exists
    if (!user.password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Account not properly configured. Please reset your password." 
        },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password" 
        },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Please verify your account first.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: user.email ? `/mobileapi/service-seller/auth/verify-otp?email=${encodeURIComponent(user.email)}` : `/mobileapi/service-seller/auth/verify-otp?phone=${encodeURIComponent(user.phone || "")}`,
          data: {
            email: user.email,
            phone: user.phone
          }
        },
        { status: 403 }
      )
    }

    // Check if seller exists
    if (!user.seller) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Seller account not properly configured. Please contact support." 
        },
        { status: 403 }
      )
    }

    // Check seller approval status
    // Relaxed: Allow login if onboarding is not completed
    if (!user.seller.isApproved && user.seller.onboardingCompleted) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Your account is pending admin approval.",
          needsApproval: true,
          approvalStatus: "PENDING"
        },
        { status: 403 }
      )
    }

    // Check if seller is suspended
    if (user.seller.isSuspended) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Your account has been suspended. Please contact support.",
          isSuspended: true
        },
        { status: 403 }
      )
    }

    // Require 2FA OTP verification for email/phone + password login
    const { generateAndSendLogin2faOtp } = await import("@/lib/login-2fa")
    const otpResult = await generateAndSendLogin2faOtp(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
      },
      UserRole.SELLER_SERVICE
    )

    if (!otpResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: otpResult.error || "Failed to send verification code. Please try again.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        requiresOtp: true,
        message: otpResult.message,
        data: {
          preAuthToken: otpResult.preAuthToken,
          maskedPhone: otpResult.maskedPhone,
          maskedEmail: otpResult.maskedEmail,
          channels: otpResult.channels,
          expiresIn: otpResult.expiresIn,
          resendCooldown: otpResult.resendCooldown,
        },
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile service seller login error:", error)
    
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