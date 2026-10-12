import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { registerUserDeviceToken, removeUserDeviceToken } from "@/lib/user-device-token"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { token, platform, userAgent, deviceId, deviceModel } = body as {
      token?: string
      platform?: string
      userAgent?: string
      deviceId?: string
      deviceModel?: string
    }

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const result = await registerUserDeviceToken(session.user.id, {
      token,
      platform: platform || "web",
      deviceId,
      deviceModel,
      userAgent,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to update device token" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        registeredTokensCount: result.registeredTokensCount,
        devices: result.devices,
      },
    })
  } catch (error) {
    console.error("Web customer device token update error:", error)
    return NextResponse.json({ error: "Failed to update device token." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { token, deviceId } = body as { token?: string; deviceId?: string }

    const result = await removeUserDeviceToken(session.user.id, { token, deviceId })

    return NextResponse.json({
      success: true,
      data: {
        remainingDevicesCount: result.remainingDevicesCount,
      },
    })
  } catch (error) {
    console.error("Web customer device token delete error:", error)
    return NextResponse.json({ error: "Failed to unregister device token." }, { status: 500 })
  }
}
