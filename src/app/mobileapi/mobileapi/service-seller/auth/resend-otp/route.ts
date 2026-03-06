import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole, Prisma } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60 // 60 seconds cooldown for resend

// Define request body interface
interface ServiceSellerRegisterRequest {
  name?: string
  email: string
  password: string
  phone?: string
  phoneCountryCode?: string
}

// Define user response type from Prisma select
type UserResponse = Pick<Prisma.UserGetPayload<{}>, 'id' | 'email' | 'name' | 'role'>

// Define verification details type
interface VerificationDetails {
  method: "OTP"
  expiresIn: number // in seconds
  resendCooldown: number // in seconds
}

// Define success response data type
interface SuccessResponseData {
  userId: string
  email: string
  name: string | null
  role: UserRole
  requiresVerification: true
  verificationDetails: VerificationDetails
  verifyUrl: string
}

// Define success response type
interface SuccessResponse {
  success: true
  message: string
  data: SuccessResponseData
}

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  data?: {
    email?: string
  }
}

// Define error response with email data type
interface ErrorResponseWithEmail extends ErrorResponse {
  data: {
    email: string
  }
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: ServiceSellerRegisterRequest
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

    // Sanitize inputs
    const sanitizedEmail = email.toLowerCase().trim()
    const sanitizedName = name?.trim() || null
    const sanitizedPhone = phone?.trim() || null
    const sanitizedPhoneCountryCode = phoneCountryCode?.trim() || null

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedEmail)) {
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

    // Validate phone if provided
    if (sanitizedPhone) {
      const phoneRegex = /^[0-9]{10}$/
      if (!phoneRegex.test(sanitizedPhone)) {
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: "Invalid phone number format. Must be 10 digits." 
          },
          { status: 400 }
        )
      }
    }

    // Check existing user
    const existingUser = await prisma.user.findUnique({ 
      where: { email: sanitizedEmail } 
    })

    if (existingUser) {
      const errorResponse: ErrorResponseWithEmail = {
        success: false,
        error: "User with this email already exists",
        data: {
          email: sanitizedEmail
        }
      }
      return NextResponse.json<ErrorResponse>(errorResponse, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Generate OTP
    const verifyEmailOtp = randomInt(100000, 999999).toString()
    const emailVerificationExpires = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    // Create user with SELLER_SERVICE role
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        name: sanitizedName,
        password: hashedPassword,
        role: UserRole.SELLER_SERVICE,
        phone: sanitizedPhone,
        phoneCountryCode: sanitizedPhoneCountryCode,
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
    })

    // Create seller record with SERVICE type
    try {
      await prisma.seller.create({ 
        data: { 
          userId: user.id, 
          type: "SERVICE" 
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
        to: sanitizedEmail,
        otp: verifyEmailOtp,
        name: sanitizedName,
      })
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      
      const successResponseData: SuccessResponseData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        requiresVerification: true,
        verificationDetails: {
          method: "OTP",
          expiresIn: OTP_EXPIRY_MS / 1000,
          resendCooldown: RESEND_COOLDOWN_SECONDS,
        },
        verifyUrl: "/mobileapi/service-seller/verify-otp"
      }
      
      return NextResponse.json<SuccessResponse>(
        { 
          success: true,
          message: "Registration successful but failed to send verification email. Please contact support.",
          data: successResponseData
        },
        { status: 201 }
      )
    }

    // Return success response
    const successResponseData: SuccessResponseData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      requiresVerification: true,
      verificationDetails: {
        method: "OTP",
        expiresIn: OTP_EXPIRY_MS / 1000, // in seconds
        resendCooldown: RESEND_COOLDOWN_SECONDS, // 60 seconds cooldown for resend
      },
      verifyUrl: "/mobileapi/service-seller/verify-otp"
    }

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "Please verify your email with the OTP sent.",
        data: successResponseData
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Mobile service seller registration error:", error)
    
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
      
      // Handle Prisma specific errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return NextResponse.json<ErrorResponse>(
            { 
              success: false,
              error: "A unique constraint would be violated." 
            },
            { status: 400 }
          )
        }
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