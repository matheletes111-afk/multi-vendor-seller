import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute cooldown

interface ResendOtpRequest {
  email: string
}

interface UserWithOtpInfo {
  id: string
  email: string
  name: string | null
  isEmailVerified: boolean
  emailOtpSentAt: Date | null
}

interface SuccessResponse {
  success: true
  message: string
  data: {
    email: string
    expiresIn: number
    resendCooldown: number
    otp?: string // Added for testing
  }
}

interface ErrorResponse {
  success: false
  error: string
  alreadyVerified?: boolean
  waitTime?: number
}

type ApiResponse = SuccessResponse | ErrorResponse

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
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

    if (!email) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email is required" 
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

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
        role: UserRole.SELLER_RESTAURANT 
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

    if (user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email already verified. You can now login to complete your onboarding profile.",
          alreadyVerified: true
        },
        { status: 400 }
      )
    }

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

    const newOtp = randomInt(100000, 999999).toString()
    const newExpiry = new Date(Date.now() + OTP_EXPIRY_MS)
    const now = new Date()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailOtp: newOtp,
        emailVerificationExpires: newExpiry,
        emailOtpSentAt: now,
      }
    })

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

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: "New OTP sent successfully",
        data: {
          email: user.email,
          expiresIn: OTP_EXPIRY_MS / 1000,
          resendCooldown: RESEND_COOLDOWN_MS / 1000,
          otp: newOtp
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile restaurant seller resend-otp error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}
