import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

interface RestaurantSellerLoginRequest {
  email?: string
  phone?: string
  identifier?: string
  password: string
  phoneCountryCode?: string
  deviceId?: string
  platform?: string
}

interface RestaurantSellerInfo {
  isApproved: boolean
  isSuspended: boolean
  onboardingCompleted: boolean
  onboardingStep: number
  mobileStep: number
  type?: string
}

interface UserWithRestaurantSeller {
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
  restaurantSeller: RestaurantSellerInfo | null
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

interface SuccessResponse {
  success: true
  message: string
  data: {
    user: Omit<UserWithRestaurantSeller, 'password' | 'restaurantSeller'> & { sellerInfo: RestaurantSellerInfo | null; sellerType: string }
    tokens: TokenResponse
    sessionInfo: {
      expiresIn: number
      tokenType: "Bearer"
    }
  }
}

interface ErrorResponse {
  success: false
  error: string
  needsVerification?: boolean
  needsApproval?: boolean
  isSuspended?: boolean
  approvalStatus?: string
  authStatus?: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED"
  verifyUrl: string
  data?: {
    email?: string | null
    phone?: string | null
  }
}

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: Partial<RestaurantSellerLoginRequest>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid JSON payload",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 400 }
      )
    }

    const identifier = (body.identifier || body.email || body.phone || "").trim()
    const password = (body.password || "").trim()
    const phoneCountryCode = (body.phoneCountryCode || "").trim()

    if (!identifier || !password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email or mobile number, and password are required",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    let user: UserWithRestaurantSeller | null = null

    if (identifier.includes("@")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(identifier)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid email format",
            verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
          },
          { status: 400 }
        )
      }

      user = (await prisma.user.findFirst({
        where: { 
          email: identifier.toLowerCase().trim(),
          role: UserRole.SELLER_RESTAURANT
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
          restaurantSeller: {
            select: {
              isApproved: true,
              isSuspended: true,
              onboardingCompleted: true,
              onboardingStep: true,
            }
          }
        }
      })) as UserWithRestaurantSeller | null
    } else {
      const variants = getEquivalentPhoneVariants(identifier, phoneCountryCode)
      user = (await prisma.user.findFirst({
        where: { 
          role: UserRole.SELLER_RESTAURANT,
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
          restaurantSeller: {
            select: {
              isApproved: true,
              isSuspended: true,
              onboardingCompleted: true,
              onboardingStep: true,
            }
          }
        }
      })) as UserWithRestaurantSeller | null
    }

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    if (!user.password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Account not properly configured. Please reset your password.",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or mobile number, or password",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    if (!user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Please verify your account first.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: user.email ? `/mobileapi/restaurant-seller/auth/verify-otp?email=${encodeURIComponent(user.email)}` : `/mobileapi/restaurant-seller/auth/verify-otp?phone=${encodeURIComponent(user.phone || "")}`,
          data: {
            email: user.email,
            phone: user.phone
          }
        },
        { status: 403 }
      )
    }

    if (!user.restaurantSeller) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Restaurant seller account not properly configured. Please contact support.",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 403 }
      )
    }

    if (!user.restaurantSeller.isApproved && user.restaurantSeller.onboardingCompleted) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Your account is pending admin approval.",
          needsApproval: true,
          approvalStatus: "PENDING",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 403 }
      )
    }

    if (user.restaurantSeller.isSuspended) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Your account has been suspended. Please contact support.",
          isSuspended: true,
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
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
      UserRole.SELLER_RESTAURANT
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
    console.error("Mobile restaurant seller login error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error",
        verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
      },
      { status: 500 }
    )
  }
}
