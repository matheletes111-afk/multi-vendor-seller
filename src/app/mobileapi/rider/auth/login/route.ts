import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { generateMobileTokens } from "@/lib/mobile-jwt"

interface RiderLoginRequest {
  email: string
  password: string
  deviceId?: string
  platform?: "android" | "ios" | "web"
  deviceToken?: string // Optional FCM/APNS token passed during login
  userAgent?: string
}

export async function POST(request: Request) {
  try {
    let body: RiderLoginRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const { email, password, deviceId, platform, deviceToken, userAgent } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail, role: UserRole.RIDER },
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

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      )
    }

    if (!user.isEmailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: "Please verify your email address before logging in.",
          needsVerification: true,
          authStatus: "PENDING_VERIFICATION",
          verifyUrl: "/mobileapi/rider/auth/verify-otp",
          data: { email: user.email },
        },
        { status: 403 }
      )
    }

    if (!user.rider) {
      return NextResponse.json(
        { success: false, error: "Rider profile not found. Please contact support." },
        { status: 403 }
      )
    }

    if (user.rider.isSuspended || user.rider.status === "SUSPENDED") {
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

    // Auto-register device token if provided during login
    if (deviceToken || deviceId) {
      try {
        const tokenToStore = deviceToken || deviceId!
        const existingTokens: any[] = Array.isArray(user.rider.deviceTokens)
          ? (user.rider.deviceTokens as any[])
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

        const updatedTokens = [newEntry, ...otherTokens].slice(0, 10) // Keep latest 10 devices

        await prisma.rider.update({
          where: { id: user.rider.id },
          data: { deviceTokens: updatedTokens },
        })
      } catch (tokenErr) {
        console.error("Failed to auto-register device token during rider login:", tokenErr)
      }
    }

    const tokens = generateMobileTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      passwordHash: user.password,
      deviceId,
      platform,
    })

    const { password: _, rider, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          rider: {
            id: rider.id,
            isApproved: rider.isApproved,
            isSuspended: rider.isSuspended,
            status: rider.status,
            onboardingCompleted: rider.onboardingCompleted,
            isFirstLogin: rider.isFirstLogin,
            vehicleTypes: rider.vehicleTypes,
            vehicleNumber: rider.vehicleNumber,
            drivingLicenseNo: rider.drivingLicenseNo,
            profileImage: rider.profileImage,
            selectedZones: rider.selectedZones,
            selectedLocations: rider.selectedLocations,
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
    console.error("Mobile rider login error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during login." },
      { status: 500 }
    )
  }
}
