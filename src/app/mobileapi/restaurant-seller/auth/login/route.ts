import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"

interface RestaurantSellerLoginRequest {
  email: string
  password: string
  deviceId?: string
  platform?: string
}

interface RestaurantSellerInfo {
  isApproved: boolean
  isSuspended: boolean
  onboardingCompleted: boolean
  onboardingStep: number
  mobileStep: number
}

interface UserWithRestaurantSeller {
  id: string
  email: string
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
    user: Omit<UserWithRestaurantSeller, 'password' | 'restaurantSeller'> & { sellerInfo: RestaurantSellerInfo | null }
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
    email?: string
  }
}

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    let body: RestaurantSellerLoginRequest
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

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email and password are required",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email format",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
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
            onboardingStep: true
          }
        }
      }
    }) as UserWithRestaurantSeller | null

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password",
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

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp"
        },
        { status: 401 }
      )
    }

    if (!user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Please verify your email first.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: "/mobileapi/restaurant-seller/auth/verify-otp",
          data: {
            email: user.email
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

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      passwordHash: user.password,
    })

    const { password: _, restaurantSeller, ...userWithoutPassword } = user

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Login successful",
        data: {
          user: {
            ...userWithoutPassword,
            sellerInfo: {
              ...restaurantSeller,
              mobileStep: Math.max(1, restaurantSeller.onboardingStep - 1)
            }
          },
          tokens,
          sessionInfo: {
            expiresIn: tokens.expiresIn,
            tokenType: "Bearer"
          }
        }
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
