import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { sendVerificationOtpEmail } from "@/lib/email"
import { getAppBaseUrl, sendEmailVerificationSms } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute cooldown

interface ResendOtpRequest {
  email?: string
  phone?: string
  phoneCountryCode?: string
}

interface UserWithOtpInfo {
  id: string
  email: string | null
  phone: string | null
  phoneCountryCode: string | null
  name: string | null
  isEmailVerified: boolean
  emailOtpSentAt: Date | null
}

interface SuccessResponse {
  success: true
  message: string
  data: {
    email: string | null
    phone: string | null
    expiresIn: number
    resendCooldown: number
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

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const phoneCountryCode = typeof body.phoneCountryCode === "string" ? body.phoneCountryCode.trim() : ""

    if (!email && !phone) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Email or mobile number is required" 
        },
        { status: 400 }
      )
    }

    let user: UserWithOtpInfo | null = null
    if (email) {
      user = await prisma.user.findFirst({
        where: { 
          email,
          role: UserRole.SELLER_HOTEL 
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          emailOtpSentAt: true,
        }
      }) as UserWithOtpInfo | null
    } else if (phone) {
      const phoneVariants = getEquivalentPhoneVariants(phone, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: { 
          phone: { in: phoneVariants },
          role: UserRole.SELLER_HOTEL 
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          emailOtpSentAt: true,
        }
      }) as UserWithOtpInfo | null
    }

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Seller not found with this email or mobile number" 
        },
        { status: 404 }
      )
    }

    if (user.isEmailVerified) {
      return NextResponse.json<ErrorResponse>(
        { 
          success: false,
          error: "Account already verified. Please login.",
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

    // Send OTP email & SMS
    const baseUrl = getAppBaseUrl(request)
    const verificationLink = `${baseUrl}/api/verify-email?token=${newOtp}`

    const sendPromises: Promise<any>[] = []
    if (user.phone) {
      sendPromises.push(
        sendEmailVerificationSms({
          to: user.phone,
          countryCode: user.phoneCountryCode,
          verificationLink,
          otp: newOtp,
          name: user.name,
        })
      )
    }
    if (user.email) {
      sendPromises.push(
        sendVerificationOtpEmail({
          to: user.email,
          otp: newOtp,
          name: user.name,
          verificationLink,
        })
      )
    }

    try {
      await Promise.allSettled(sendPromises)
    } catch (sendError) {
      console.error("Failed to send OTP email/SMS:", sendError)
    }

    return NextResponse.json<SuccessResponse>(
      { 
        success: true,
        message: user.email
          ? "New OTP sent to your email and mobile number"
          : "New OTP sent to your mobile number via SMS",
        data: {
          email: user.email,
          phone: user.phone,
          expiresIn: OTP_EXPIRY_MS / 1000,
          resendCooldown: RESEND_COOLDOWN_MS / 1000
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Mobile hotel seller resend-otp error:", error)
    return NextResponse.json<ErrorResponse>(
      { 
        success: false,
        error: "Internal server error" 
      },
      { status: 500 }
    )
  }
}
