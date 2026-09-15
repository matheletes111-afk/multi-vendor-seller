import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

// Define request body interface
interface LoginRequest {
  email?: string
  phone?: string
  identifier?: string
  password: string
  phoneCountryCode?: string
}

// Define the user type returned from our select query
interface SelectedUser {
  id: string
  email: string | null
  name: string | null
  password: string | null
  role: UserRole
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// Define user type without password for response
type UserWithoutPassword = Omit<SelectedUser, 'password'>

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
    user: any
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
  isVerified?: boolean
  authStatus?: string
  verifyUrl?: string
  data?: {
    email?: string | null
    phone?: string | null
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse and validate request body
    const body = (await request.json().catch(() => ({}))) as Partial<LoginRequest>
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

    let user: SelectedUser | null = null

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
          role: UserRole.CUSTOMER
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
          updatedAt: true
        }
      })) as SelectedUser | null
    } else {
      const variants = getEquivalentPhoneVariants(identifier, phoneCountryCode)
      user = (await prisma.user.findFirst({
        where: { 
          role: UserRole.CUSTOMER,
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
          updatedAt: true
        }
      })) as SelectedUser | null
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

    // Check if password exists in database
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
          error: "Invalid email or mobile number, or password" 
        },
        { status: 401 }
      )
    }

    // Check if account is verified
    if (!user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Please verify your account first",
          needsVerification: true,
          isVerified: false,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: user.email ? `/mobileapi/customer/auth/verify-otp?email=${encodeURIComponent(user.email)}` : `/mobileapi/customer/auth/verify-otp?phone=${encodeURIComponent(user.phone || "")}`,
          data: {
            email: user.email,
            phone: user.phone
          }
        },
        { status: 403 }
      )
    }

    // Generate JWT tokens including phone
    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      passwordHash: user.password
    })

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    const UserDetails = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        password: true,
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        phoneCountryCode: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  

    // Return success response
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Login successful",
        data: {
          // user: userWithoutPassword,
          user: {
            ...UserDetails,
            sellerType: null
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
    // Log error for debugging
    console.error("Mobile customer login error:", error)
    
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