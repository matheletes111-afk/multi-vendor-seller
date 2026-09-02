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

    // Auto-heal: if rider row is missing for a verified user, create it rather than hard-blocking
    let riderProfile = user.rider
    if (!riderProfile) {
      try {
        riderProfile = await prisma.rider.create({
          data: {
            userId: user.id,
            isApproved: true,
            isSuspended: false,
            status: "APPROVED",
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

    // Auto-register device token if provided during login
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

        const updatedTokens = [newEntry, ...otherTokens].slice(0, 10) // Keep latest 10 devices

        await prisma.rider.update({
          where: { id: riderProfile.id },
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

    const { password: _, rider: _rider, ...userWithoutPassword } = user

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
    console.error("Mobile rider login error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error during login." },
      { status: 500 }
    )
  }
}
