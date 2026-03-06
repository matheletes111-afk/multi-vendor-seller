import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"

// Define request body interface
interface ServiceSellerLoginRequest {
  email: string
  password: string
  deviceId?: string
  platform?: string
}

// Define seller info type from the select query
interface SellerInfo {
  isApproved: boolean
  isSuspended: boolean
  type: string | null
}

// Define user with seller type
interface UserWithSeller {
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
    user: Omit<UserWithSeller, 'password' | 'seller'> & { sellerInfo: SellerInfo | null }
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
  verifyUrl?: string
  data?: {
    email?: string
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: ServiceSellerLoginRequest
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

    const { email, password, deviceId, platform } = body

    // Validation
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

    // Validate password
    if (password.length < 6) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password" 
        },
        { status: 401 }
      )
    }

    // Find user with SELLER_SERVICE role
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
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
            type: true
          }
        }
      }
    }) as UserWithSeller | null

    // Check if user exists
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password" 
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
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid email or password" 
        },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Please verify your email first.",
          needsVerification: true,
          verifyUrl: "/mobileapi/service-seller/verify-otp",
          data: {
            email: user.email
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
    if (!user.seller.isApproved) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Your account is pending admin approval. You cannot log in until approved.",
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

    // Generate JWT tokens
    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Remove password from response
    const { password: _, seller, ...userWithoutPassword } = user

    // Return success with user details and tokens
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Login successful",
        data: {
          user: {
            ...userWithoutPassword,
            sellerInfo: seller
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