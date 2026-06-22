import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

interface VerifyOtpRequest {
  email: string
  otp: string
}

interface UserWithOtpInfo {
  id: string
  email: string
  name: string | null
  verifyEmailOtp: string | null
  emailVerificationExpires: Date | null
  isEmailVerified: boolean
}

interface VerifiedResponseData {
  email: string
  isEmailVerified: true
  approvalStatus: "PENDING"
  loginAvailable: true
  sellerType: string
}

interface AlreadyVerifiedResponse {
  success: true
  message: string
  data: VerifiedResponseData
}

interface NewlyVerifiedResponse {
  success: true
  message: string
  data: VerifiedResponseData & {
    nextSteps: string
  }
}

interface ErrorResponse {
  success: false
  error: string
  expired?: boolean
}

type ApiResponse = AlreadyVerifiedResponse | NewlyVerifiedResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
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

    if (!email || !otp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email and OTP are required" 
        },
        { status: 400 }
      )
    }

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

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
        role: UserRole.SELLER_RESTAURANT 
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

    if (user.isEmailVerified) {
      const responseData: VerifiedResponseData = {
        email: user.email,
        isEmailVerified: true,
        approvalStatus: "PENDING",
        loginAvailable: true,
        sellerType: "restaurant"
      }

      return NextResponse.json<AlreadyVerifiedResponse>(
        { 
          success: true,
          message: "Your email is verified successfully. You can now login to complete your onboarding profile.",
          data: responseData
        },
        { status: 200 }
      )
    }

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

    if (user.verifyEmailOtp !== otp) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Invalid OTP." 
        },
        { status: 400 }
      )
    }

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

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        isEmailVerified: true, 
        verifyEmailOtp: null, 
        emailVerificationExpires: null, 
        emailOtpSentAt: null,
      },
    })

    const responseData: NewlyVerifiedResponse["data"] = {
      email: user.email,
      isEmailVerified: true,
      approvalStatus: "PENDING",
      loginAvailable: true,
      nextSteps: "Please login to complete your onboarding process.",
      sellerType: "restaurant"
    }

    return NextResponse.json<NewlyVerifiedResponse>(
      { 
        success: true,
        message: "Your email is verified successfully. You can now login to complete your onboarding profile.",
        data: responseData
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile restaurant seller verify-otp error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}
