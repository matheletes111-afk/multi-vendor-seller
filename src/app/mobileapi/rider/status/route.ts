import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/firebase-messaging"

const SOCKET_SERVER_URL =
  process.env.SOCKET_SERVER_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://socket.meeemsl.com"

// GET /mobileapi/rider/status — Fetch current online/offline & operational status
export async function GET(request: NextRequest) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const rider = await prisma.rider.findUnique({
      where: { id: authResult.rider.id },
      include: {
        deliveryAssignments: {
          where: {
            status: { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] },
          },
          take: 1,
        },
      },
    })

    if (!rider) {
      return NextResponse.json({ success: false, error: "Rider not found" }, { status: 404 })
    }

    const activeAssignment = rider.deliveryAssignments?.[0] || null
    const isBusy = !!activeAssignment

    const nowMs = Date.now()
    const lastUpdateMs = rider.lastLocationUpdate ? new Date(rider.lastLocationUpdate).getTime() : 0
    const isLocationRecent = lastUpdateMs > 0 && (nowMs - lastUpdateMs) < 10 * 60 * 1000

    let operationalStatus: "FREE" | "ON_DELIVERY" | "OFFLINE" = "OFFLINE"
    if (rider.isOnline) {
      if (isBusy) {
        operationalStatus = "ON_DELIVERY"
      } else if (isLocationRecent) {
        operationalStatus = "FREE"
      } else {
        operationalStatus = "OFFLINE"
      }
    } else {
      operationalStatus = "OFFLINE"
    }

    const existingDevices: any[] = Array.isArray(rider.deviceTokens) ? (rider.deviceTokens as any[]) : []
    const activeDevice = existingDevices.find((d) => d.isActiveDriver && d.deviceId)

    return NextResponse.json({
      success: true,
      data: {
        riderId: rider.id,
        isOnline: rider.isOnline,
        operationalStatus,
        lastLocationUpdate: rider.lastLocationUpdate,
        currentLatitude: rider.currentLatitude,
        currentLongitude: rider.currentLongitude,
        activeAssignmentId: activeAssignment?.id || null,
        activeDeviceId: activeDevice?.deviceId || null,
        activeDeviceModel: activeDevice?.deviceModel || null,
      },
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider status GET error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch rider status" },
      { status: 500 }
    )
  }
}

// POST or PATCH /mobileapi/rider/status — Update online/offline status
async function handleUpdateStatus(request: NextRequest) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    let newIsOnline: boolean | null = null

    if (body.isOnline !== undefined) {
      newIsOnline = Boolean(body.isOnline)
    } else if (typeof body.status === "string") {
      const s = body.status.toLowerCase().trim()
      if (s === "online" || s === "free" || s === "available") newIsOnline = true
      if (s === "offline" || s === "inactive") newIsOnline = false
    }

    if (newIsOnline === null) {
      return NextResponse.json(
        { success: false, error: "isOnline (boolean) or status ('online' | 'offline') is required" },
        { status: 400 }
      )
    }

    const clientDeviceId = body.deviceId ? String(body.deviceId).trim() : null
    const clientDeviceModel = body.deviceModel ? String(body.deviceModel).trim() : null

    const currentRider = await prisma.rider.findUnique({
      where: { id: authResult.rider.id },
      select: { id: true, deviceTokens: true },
    })

    let existingDevices: any[] = Array.isArray(currentRider?.deviceTokens)
      ? (currentRider!.deviceTokens as any[])
      : []
    let previousActiveDevice: any = null

    if (newIsOnline) {
      if (clientDeviceId) {
        // Single Active Driving Device rule:
        // Find if another device was previously active
        previousActiveDevice = existingDevices.find(
          (d) => d.isActiveDriver && d.deviceId && d.deviceId !== clientDeviceId
        )

        // Set the calling device as active, and all other devices as inactive
        let matched = false
        existingDevices = existingDevices.map((d) => {
          if (d.deviceId === clientDeviceId) {
            matched = true
            return {
              ...d,
              isActiveDriver: true,
              deviceModel: clientDeviceModel || d.deviceModel,
              lastActiveAt: new Date().toISOString(),
            }
          }
          return { ...d, isActiveDriver: false }
        })

        // If the calling device wasn't in deviceTokens yet, register it
        if (!matched) {
          existingDevices.unshift({
            token: body.token || null,
            deviceId: clientDeviceId,
            platform: body.platform || "mobile",
            deviceModel: clientDeviceModel,
            isActiveDriver: true,
            lastActiveAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          })
        }
      }
    } else {
      // Going offline: deactivate driving state on all devices
      existingDevices = existingDevices.map((d) => ({ ...d, isActiveDriver: false }))
    }

    const updateData: any = {
      isOnline: newIsOnline,
      lastLocationUpdate: new Date(),
      deviceTokens: existingDevices,
    }

    if (body.latitude != null && body.longitude != null) {
      const lat = Number(body.latitude)
      const lng = Number(body.longitude)
      if (!isNaN(lat) && !isNaN(lng)) {
        updateData.currentLatitude = lat
        updateData.currentLongitude = lng
      }
    }

    const updatedRider = await prisma.rider.update({
      where: { id: authResult.rider.id },
      data: updateData,
      select: {
        id: true,
        isOnline: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationUpdate: true,
      },
    })

    // If device switched, notify previous active device via Push & Socket
    if (previousActiveDevice && newIsOnline && clientDeviceId) {
      const switchMessage = `You have switched to another device (${clientDeviceModel || "another phone"}). Tracking stopped on this device.`

      // 1. Send high-priority FCM Push Notification to the previous device
      if (previousActiveDevice.token) {
        sendPushNotification({
          tokens: [previousActiveDevice.token],
          title: "Device Switched",
          body: switchMessage,
          data: {
            type: "DEVICE_SWITCHED",
            activeDeviceId: clientDeviceId,
            message: switchMessage,
          },
          riderId: authResult.rider.id,
        }).catch(() => {})
      }

      // 2. Broadcast via Socket.IO to rider room
      fetch(`${SOCKET_SERVER_URL}/internal/rider-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderId: authResult.rider.id,
          isOnline: true,
          activeDeviceId: clientDeviceId,
          activeDeviceModel: clientDeviceModel,
          previousDeviceId: previousActiveDevice.deviceId,
          switchedDevice: true,
          switchMessage,
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    } else {
      // Normal online/offline status broadcast to Socket.IO
      fetch(`${SOCKET_SERVER_URL}/internal/rider-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderId: authResult.rider.id,
          isOnline: newIsOnline,
          activeDeviceId: clientDeviceId,
          latitude: updatedRider.currentLatitude,
          longitude: updatedRider.currentLongitude,
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: `Rider is now ${newIsOnline ? "ONLINE" : "OFFLINE"}.`,
      data: {
        id: updatedRider.id,
        isOnline: updatedRider.isOnline,
        lastLocationUpdate: updatedRider.lastLocationUpdate,
        activeDeviceId: clientDeviceId,
      },
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider status update error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update rider status" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return handleUpdateStatus(request)
}

export async function PATCH(request: NextRequest) {
  return handleUpdateStatus(request)
}
