import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

// Constants
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute cooldown

// Define request body interface
interface ResendOtpRequest {
  email: string
}

// Define user select type
interface UserWithOtpInfo {
  id: string
  email: string
  name: string | null
  isEmailVerified: boolean
  emailOtpSentAt: Date | null
}

// Define success response type
interface SuccessResponse {
  success: true
  message: string
  data: {
    email: string
    expiresIn: number
    resendCooldown: number
  }
}

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  alreadyVerified?: boolean
  waitTime?: number
}

// Union type for all possible responses
type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body with error handling
    let body: ResendOtpRequest
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

    const email = typeof body.email === "string" ? body.email.trim() : ""

    // Validation
    if (!email) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email is required" 
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

    // Find user with SELLER_PRODUCT role
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
        role: UserRole.SELLER_PRODUCT 
      },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
        emailOtpSentAt: true,
      }
    }) as UserWithOtpInfo | null

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Seller not found with this email" 
        },
        { status: 404 }
      )
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email already verified. Please wait for admin approval.",
          alreadyVerified: true
        },
        { status: 400 }
      )
    }

    // Check cooldown period
    if (user.emailOtpSentAt) {
      const timeSinceLastOtp = Date.now() - user.emailOtpSentAt.getTime()
      if (timeSinceLastOtp < RESEND_COOLDOWN_MS) {
        const waitTime = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastOtp) / 1000)
        return NextResponse.json<ErrorResponse>(
          { 
            success: false,
            error: `Please wait ${waitTime} seconds before requesting a new OTP`,
            waitTime
          },
          { status: 429 }
        )
      }
    }

    // Generate new OTP
    const newOtp = randomInt(100000, 999999).toString()
    const newExpiry = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    // Update user with new OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: newOtp,
        emailVerificationExpires: newExpiry,
        emailOtpSentAt: now,
      }
    })

    // Send OTP email
    try {
      await sendVerificationOtpEmail({
        to: email,
        otp: newOtp,
        name: user.name,
      })
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError)
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Failed to send OTP email. Please try again." 
        },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "New OTP sent successfully",
        data: {
          email: user.email,
          expiresIn: OTP_EXPIRY_MS / 1000, // in seconds
          resendCooldown: RESEND_COOLDOWN_MS / 1000 // in seconds
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile product seller resend-otp error:", error)
    
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