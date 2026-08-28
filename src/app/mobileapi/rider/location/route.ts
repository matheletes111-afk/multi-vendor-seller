import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

const SOCKET_SERVER_URL =
  process.env.SOCKET_SERVER_INTERNAL_URL ||
  process.env.NEXTJS_INTERNAL_URL?.replace("3000", "3001") ||
  "http://localhost:3001"

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

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: "latitude and longitude are required" },
        { status: 400 }
      )
    }

    const numLat = Number(latitude)
    const numLng = Number(longitude)

    const rider = await prisma.rider.update({
      where: { id: authResult.rider.id },
      data: {
        currentLatitude: numLat,
        currentLongitude: numLng,
        heading: heading != null ? Number(heading) : undefined,
        speed: speed != null ? Number(speed) : undefined,
        isOnline: isOnline != null ? Boolean(isOnline) : true,
        lastLocationUpdate: new Date(),
      },
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
