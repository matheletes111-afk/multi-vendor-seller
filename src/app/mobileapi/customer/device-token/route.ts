import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { registerUserDeviceToken, removeUserDeviceToken } from "@/lib/user-device-token"

/**
 * POST /mobileapi/customer/device-token — Register or update FCM/APNS push token for customer after login
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
    if (!authResult.ok) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or expired mobile session." },
        { status: 401 }
      )
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

    const result = await registerUserDeviceToken(authResult.userId, {
      token,
      platform,
      deviceId,
      deviceModel,
      userAgent,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Failed to register token" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "Customer device token registered successfully for push notifications.",
      data: {
        registeredTokensCount: result.registeredTokensCount,
        devices: result.devices,
      },
    })
  } catch (error) {
    console.error("Mobile customer device token update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update device token." },
      { status: 500 }
    )
  }
}

/**
 * DELETE /mobileapi/customer/device-token — Unregister device token upon customer logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileCustomerAuth(request)
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

    const result = await removeUserDeviceToken(authResult.userId, { token, deviceId })

    return NextResponse.json({
      success: true,
      message: "Customer device token unregistered successfully.",
      data: {
        remainingDevicesCount: result.remainingDevicesCount,
      },
    })
  } catch (error) {
    console.error("Mobile customer device token delete error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to unregister device token." },
      { status: 500 }
    )
  }
}
