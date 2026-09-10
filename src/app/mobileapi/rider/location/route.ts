import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

const SOCKET_SERVER_URL =
  process.env.SOCKET_SERVER_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://socket.meeemsl.com"

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { latitude, longitude, heading, speed, isOnline, orderId } = body

    const isOnlineBool = isOnline != null ? Boolean(isOnline) : true

    // If online, latitude and longitude are required. If setting offline, they are optional.
    if (isOnlineBool && (latitude == null || longitude == null)) {
      return NextResponse.json(
        { success: false, error: "latitude and longitude are required when going online" },
        { status: 400 }
      )
    }

    const numLat = latitude != null ? Number(latitude) : undefined
    const numLng = longitude != null ? Number(longitude) : undefined

    const clientDeviceId = body.deviceId ? String(body.deviceId).trim() : null
    if (clientDeviceId) {
      const currentRider = await prisma.rider.findUnique({
        where: { id: authResult.rider.id },
        select: { deviceTokens: true },
      })
      const existingDevices: any[] = Array.isArray(currentRider?.deviceTokens)
        ? (currentRider!.deviceTokens as any[])
        : []
      const activeDevice = existingDevices.find((d) => d.isActiveDriver && d.deviceId)

      if (activeDevice && activeDevice.deviceId !== clientDeviceId) {
        return NextResponse.json(
          {
            success: false,
            error: "DEVICE_SWITCHED",
            message: `You have switched to another device (${activeDevice.deviceModel || activeDevice.platform || "another phone"}). Tracking stopped on this device.`,
            activeDeviceId: activeDevice.deviceId,
            shouldStopTracking: true,
          },
          { status: 409 }
        )
      }
    }

    const updateData: any = {
      isOnline: isOnlineBool,
      lastLocationUpdate: new Date(),
    }
    if (numLat != null && !isNaN(numLat)) updateData.currentLatitude = numLat
    if (numLng != null && !isNaN(numLng)) updateData.currentLongitude = numLng
    if (heading != null && !isNaN(Number(heading))) updateData.heading = Number(heading)
    if (speed != null && !isNaN(Number(speed))) updateData.speed = Number(speed)

    const rider = await prisma.rider.update({
      where: { id: authResult.rider.id },
      data: updateData,
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        isOnline: true,
        lastLocationUpdate: true,
      },
    })

    // Fire-and-forget: push GPS to Socket.IO server so live tracking maps update
    // Mobile riders who use REST (vs native Socket.IO) still broadcast to watchers
    const socketPayload = {
      riderId: authResult.rider.id,
      orderId: orderId || null,
      latitude: numLat,
      longitude: numLng,
      heading: heading != null ? Number(heading) : 0,
      speed: speed != null ? Number(speed) : 0,
    }
    fetch(`${SOCKET_SERVER_URL}/internal/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(socketPayload),
    }).catch(() => {
      /* non-critical — socket server may not have this REST endpoint */
    })

    return NextResponse.json({
      success: true,
      message: "Location updated successfully",
      data: rider,
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider location update error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update location" },
      { status: 500 }
    )
  }
}
