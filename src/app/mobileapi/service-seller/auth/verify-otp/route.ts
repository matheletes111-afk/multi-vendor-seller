import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

// Define request body interface
interface VerifyOtpRequest {
  email: string
  otp: string
}

// Define user select type
interface UserWithOtpInfo {
  id: string
  email: string
  name: string | null
  verifyEmailOtp: string | null
  emailVerificationExpires: Date | null
  isEmailVerified: boolean
}

// Define base data for verified responses
interface VerifiedResponseData {
  email: string
  isEmailVerified: true
  approvalStatus: "PENDING"
  loginAvailable: false
}

// Define success response for already verified
interface AlreadyVerifiedResponse {
  success: true
  message: string
  data: VerifiedResponseData
}

// Define success response for newly verified
interface NewlyVerifiedResponse {
  success: true
  message: string
  data: VerifiedResponseData & {
    nextSteps: string
  }
}

// Define error response type
interface ErrorResponse {
  success: false
  error: string
  expired?: boolean
}

// Union type for all possible responses
type ApiResponse = AlreadyVerifiedResponse | NewlyVerifiedResponse | ErrorResponse

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

    const email = typeof body.email === "string" ? body.email.trim() : ""
    const otp = typeof body.otp === "string" ? body.otp.trim() : ""

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
        verifyEmailOtp: true, 
        emailVerificationExpires: true, 
        isEmailVerified: true
      },
    }) as UserWithOtpInfo | null

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
      const responseData: VerifiedResponseData = {
        email: user.email,
        isEmailVerified: true,
        approvalStatus: "PENDING",
        loginAvailable: false
      }

      return NextResponse.json<AlreadyVerifiedResponse>(
        { 
          success: true,
          message: "Your email is already verified. You are currently in awaiting approval stage. Once admin approves, you can login.",
          data: responseData
        },
        { status: 200 }
      )
    }

    // Check if OTP exists
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
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        isEmailVerified: true, 
        verifyEmailOtp: null, 
        emailVerificationExpires: null, 
        emailOtpSentAt: null,
      },
    })

    // Return success message - NO TOKENS, just verification message
    const responseData: NewlyVerifiedResponse["data"] = {
      email: user.email,
      isEmailVerified: true,
      approvalStatus: "PENDING",
      loginAvailable: false,
      nextSteps: "Please wait for admin approval. You will be notified once your account is approved."
    }

    return NextResponse.json<NewlyVerifiedResponse>(
      { 
        success: true,
        message: "Your email is verified successfully. You are currently in awaiting approval stage. Once admin approves, you can login.",
        data: responseData
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile service seller verify-otp error:", error)
    
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