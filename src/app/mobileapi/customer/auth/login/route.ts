import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"

// Define request body interface
interface LoginRequest {
  email: string
  password: string
}

// Define the user type returned from our select query
interface SelectedUser {
  id: string
  email: string
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
    user: UserWithoutPassword
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
  verifyUrl?: string
  data?: {
    email: string
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse and validate request body
    const body: LoginRequest = await request.json()
    const { email, password } = body

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

    // Find user with CUSTOMER role
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
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
    }) as SelectedUser | null

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
          error: "Please verify your email first",
          needsVerification: true,
          verifyUrl: "/mobileapi/customer/verify-otp",
          data: {
            email: user.email
          }
        },
        { status: 403 }
      )
    }

    // Generate JWT tokens - removed deviceId and platform
    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    // Return success response
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
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