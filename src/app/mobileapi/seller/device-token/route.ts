import { NextRequest, NextResponse } from "next/server"
import { getMobileAnySellerAuth } from "@/app/mobileapi/_helpers/seller-auth"
import { registerUserDeviceToken, removeUserDeviceToken } from "@/lib/user-device-token"

/**
 * POST /mobileapi/seller/device-token — Register or update FCM/APNS push token for seller after login
 * Supports all seller categories: SELLER_PRODUCT, SELLER_SERVICE, SELLER_HOTEL, SELLER_RESTAURANT
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAnySellerAuth(request)
    if (!authResult.ok) {
      const statusCode = authResult.error === "forbidden" ? 403 : 401
      return NextResponse.json(
        { success: false, error: authResult.error === "forbidden" ? "Forbidden: Seller role required." : "Unauthorized: Invalid or expired mobile session." },
        { status: statusCode }
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
      message: "Seller device token registered successfully for push notifications.",
      data: {
        role: authResult.role,
        registeredTokensCount: result.registeredTokensCount,
        devices: result.devices,
      },
    })
  } catch (error) {
    console.error("Mobile seller device token update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update device token." },
      { status: 500 }
    )
  }
}

/**
 * DELETE /mobileapi/seller/device-token — Unregister device token upon seller logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileAnySellerAuth(request)
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
      message: "Seller device token unregistered successfully.",
      data: {
        remainingDevicesCount: result.remainingDevicesCount,
      },
    })
  } catch (error) {
    console.error("Mobile seller device token delete error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to unregister device token." },
      { status: 500 }
    )
  }
}
