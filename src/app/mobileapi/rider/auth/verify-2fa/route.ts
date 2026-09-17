import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyLogin2faOtp } from "@/lib/login-2fa"
import { generateMobileTokens } from "@/lib/mobile-jwt"

/** POST /mobileapi/rider/auth/verify-2fa — Verify 2FA OTP for Rider mobile login */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { preAuthToken, otp, deviceId, platform, deviceToken, userAgent } = body as {
      preAuthToken?: string
      otp?: string
      deviceId?: string
      platform?: "android" | "ios" | "web"
      deviceToken?: string
      userAgent?: string
    }

    if (!preAuthToken || !otp) {
      return NextResponse.json(
        { success: false, error: "Verification session token and 6-digit code are required." },
        { status: 400 }
      )
    }

    const verification = await verifyLogin2faOtp({ preAuthToken, otp })
    if (!verification.success || !verification.user) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "Invalid verification code.",
          sessionExpired: verification.sessionExpired,
          codeExpired: verification.codeExpired,
        },
        { status: 400 }
      )
    }

    const user = verification.user
    let riderProfile = (user as any).rider

    if (!riderProfile) {
      return NextResponse.json(
        { success: false, error: "Rider profile not found. Please contact support." },
        { status: 403 }
      )
    }

    if (riderProfile.isSuspended || riderProfile.status === "SUSPENDED") {
      return NextResponse.json(
        {
          success: false,
          error: "Your rider account has been suspended. Please contact support.",
          isSuspended: true,
        },
        { status: 403 }
      )
    }

    if (deviceToken || deviceId) {
      try {
        const tokenToStore = deviceToken || deviceId!
        const existingTokens: any[] = Array.isArray(riderProfile.deviceTokens)
          ? (riderProfile.deviceTokens as any[])
          : []

        const now = new Date().toISOString()
        const otherTokens = existingTokens.filter((t) => t && t.token !== tokenToStore && t.deviceId !== deviceId)

        const newEntry = {
          token: tokenToStore,
          deviceId: deviceId || null,
          platform: platform || "android",
          userAgent: userAgent || null,
          lastActiveAt: now,
          createdAt: now,
        }

        await prisma.rider.update({
          where: { id: riderProfile.id },
          data: {
            deviceTokens: [...otherTokens, newEntry],
          },
        })
      } catch (tokenErr) {
        console.warn("Failed to auto-register device token during rider 2FA verification:", tokenErr)
      }
    }

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      passwordHash: user.password,
      deviceId,
      platform,
    })

    const { password: _, rider: _rider, ...userWithoutPassword } = user as any

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          rider: {
            id: riderProfile.id,
            isApproved: riderProfile.isApproved,
            isSuspended: riderProfile.isSuspended,
            status: riderProfile.status,
            onboardingCompleted: riderProfile.onboardingCompleted,
            isFirstLogin: riderProfile.isFirstLogin,
            vehicleTypes: riderProfile.vehicleTypes,
            vehicleNumber: riderProfile.vehicleNumber,
            drivingLicenseNo: riderProfile.drivingLicenseNo,
            profileImage: riderProfile.profileImage,
            selectedZones: riderProfile.selectedZones,
            selectedLocations: riderProfile.selectedLocations,
          },
          tokens,
          sessionInfo: {
            expiresIn: tokens.expiresIn,
            tokenType: "Bearer",
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mobile rider 2FA verification error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during verification." },
      { status: 500 }
    )
  }
}
