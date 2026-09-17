import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

interface RiderLoginRequest {
  email?: string
  phone?: string
  identifier?: string
  password: string
  phoneCountryCode?: string
  deviceId?: string
  platform?: "android" | "ios" | "web"
  deviceToken?: string // Optional FCM/APNS token passed during login
  userAgent?: string
}

export async function POST(request: Request) {
  try {
    let body: Partial<RiderLoginRequest>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const identifier = (body.identifier || body.email || body.phone || "").trim()
    const password = (body.password || "").trim()
    const phoneCountryCode = (body.phoneCountryCode || "").trim()
    const { deviceId, platform, deviceToken, userAgent } = body

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Email or mobile number, and password are required" },
        { status: 400 }
      )
    }

    let user: any = null

    if (identifier.includes("@")) {
      user = await prisma.user.findFirst({
        where: { email: identifier.toLowerCase().trim(), role: UserRole.RIDER },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          phone: true,
          phoneCountryCode: true,
          image: true,
          isEmailVerified: true,
          createdAt: true,
          rider: true,
        },
      })
    } else {
      const variants = getEquivalentPhoneVariants(identifier, phoneCountryCode)
      user = await prisma.user.findFirst({
        where: {
          role: UserRole.RIDER,
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
          image: true,
          isEmailVerified: true,
          createdAt: true,
          rider: true,
        },
      })
    }

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: "Invalid email or mobile number, or password" },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or mobile number, or password" },
        { status: 401 }
      )
    }

    if (!user.isEmailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: "Please verify your account before logging in.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: user.email ? `/mobileapi/rider/auth/verify-otp?email=${encodeURIComponent(user.email)}` : `/mobileapi/rider/auth/verify-otp?phone=${encodeURIComponent(user.phone || "")}`,
          data: { email: user.email, phone: user.phone },
        },
        { status: 403 }
      )
    }

    // Auto-heal: if rider row is missing for a verified user, create it rather than hard-blocking
    let riderProfile = user.rider
    if (!riderProfile) {
      try {
        riderProfile = await prisma.rider.create({
          data: {
            userId: user.id,
            isApproved: false,
            isSuspended: false,
            status: "PENDING",
            createdByAdmin: false,
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        })
        console.warn(`Auto-healed missing rider row for userId=${user.id} during login.`)
      } catch (healErr) {
        console.error("Failed to auto-heal missing rider row during login:", healErr)
        return NextResponse.json(
          { success: false, error: "Rider profile not found. Please contact support." },
          { status: 403 }
        )
      }
    }

    if (riderProfile.isSuspended || riderProfile.status === "SUSPENDED") {
      return NextResponse.json(
        {
          success: false,
          error: "Your rider account has been suspended. Please contact support.",
          isSuspended: true,
          authStatus: "SUSPENDED",
        },
        { status: 403 }
      )
    }

    // Require 2FA OTP verification for email/phone + password login
    const { generateAndSendLogin2faOtp } = await import("@/lib/login-2fa")
    const otpResult = await generateAndSendLogin2faOtp(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
      },
      UserRole.RIDER
    )

    if (!otpResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: otpResult.error || "Failed to send verification code. Please try again.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        requiresOtp: true,
        message: otpResult.message,
        data: {
          preAuthToken: otpResult.preAuthToken,
          maskedPhone: otpResult.maskedPhone,
          maskedEmail: otpResult.maskedEmail,
          channels: otpResult.channels,
          expiresIn: otpResult.expiresIn,
          resendCooldown: otpResult.resendCooldown,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile rider login error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during login." },
      { status: 500 }
    )
  }
}
