import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

// POST /mobileapi/rider/device-token — Register or update FCM/APNS push token
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileRiderAuth(request)
    if (!authResult.ok) {
      const statusCode = authResult.error === "suspended" ? 403 : 401
      const errorMessage =
        authResult.error === "suspended"
          ? "Your rider account has been suspended. Please contact support."
          : "Unauthorized: Invalid or expired mobile session."
      return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode })
    }

    const body = await request.json().catch(() => ({}))
    const { token, platform, deviceId, deviceModel, userAgent } = body as {
      token?: string
      platform?: "android" | "ios" | "web"
      deviceId?: string
      deviceModel?: string
      userAgent?: string
    }

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Device push token is required" }, { status: 400 })
    }

    const cleanToken = token.trim()
    const cleanPlatform = platform || "android"
    const now = new Date().toISOString()

    const rider = await prisma.rider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true, deviceTokens: true },
    })

    if (!rider) {
      return NextResponse.json({ success: false, error: "Rider profile not found" }, { status: 404 })
    }

    let existingTokens: Array<{
      token: string
      deviceId?: string | null
      platform: string
      deviceModel?: string | null
      userAgent?: string | null
      lastActiveAt: string
      createdAt?: string
    }> = []

    if (Array.isArray(rider.deviceTokens)) {
      existingTokens = rider.deviceTokens as any
    }

    // Filter out existing matching token or matching deviceId
    const otherTokens = existingTokens.filter(
      (item) => item.token !== cleanToken && (!deviceId || item.deviceId !== deviceId)
    )

    const newEntry = {
      token: cleanToken,
      deviceId: deviceId || null,
      platform: cleanPlatform,
      deviceModel: deviceModel || null,
      userAgent: userAgent?.slice(0, 200) || null,
      lastActiveAt: now,
      createdAt: now,
    }

    // Maintain latest 10 devices
    const updatedTokens = [newEntry, ...otherTokens].slice(0, 10)

    await prisma.rider.update({
      where: { id: rider.id },
      data: { deviceTokens: updatedTokens },
    })

    return NextResponse.json({
      success: true,
      message: "Device token registered successfully for push notifications.",
      data: {
        registeredTokensCount: updatedTokens.length,
        devices: updatedTokens,
      },
    })
  } catch (error) {
    console.error("Mobile rider device token update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update device token." },
      { status: 500 }
    )
  }
}

// DELETE /mobileapi/rider/device-token — Unregister device token upon rider logout
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileRiderAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { token, deviceId } = body as { token?: string; deviceId?: string }

    if (!token && !deviceId) {
      return NextResponse.json(
        { success: false, error: "Token or deviceId is required to unregister" },
        { status: 400 }
      )
    }

    const rider = await prisma.rider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true, deviceTokens: true },
    })

    if (!rider || !Array.isArray(rider.deviceTokens)) {
      return NextResponse.json({ success: true, message: "Token removed." })
    }

    const remainingTokens = (rider.deviceTokens as any[]).filter(
      (item) => (token ? item.token !== token.trim() : true) && (deviceId ? item.deviceId !== deviceId : true)
    )

    await prisma.rider.update({
      where: { id: rider.id },
      data: { deviceTokens: remainingTokens },
    })

    return NextResponse.json({
      success: true,
      message: "Device token unregistered successfully.",
      data: {
        remainingDevicesCount: remainingTokens.length,
      },
    })
  } catch (error) {
    console.error("Mobile rider device token delete error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to unregister device token." },
      { status: 500 }
    )
  }
}
