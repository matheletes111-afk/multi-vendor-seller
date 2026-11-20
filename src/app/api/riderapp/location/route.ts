import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncRiderLocationToSocket } from "@/lib/order-location"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { latitude, longitude, heading, speed, isOnline } = body

    const isOnlineBool = isOnline != null ? Boolean(isOnline) : true

    if (isOnlineBool && (latitude == null || longitude == null)) {
      return NextResponse.json(
        { error: "latitude and longitude are required when going online" },
        { status: 400 }
      )
    }

    const updateData: any = {
      isOnline: isOnlineBool,
      lastLocationUpdate: new Date(),
    }
    if (latitude != null && longitude != null) {
      updateData.currentLatitude = Number(latitude)
      updateData.currentLongitude = Number(longitude)
      if (heading != null) updateData.heading = Number(heading)
      if (speed != null) updateData.speed = Number(speed)
    }

    const rider = await prisma.rider.update({
      where: { userId: session.user.id },
      data: updateData,
      select: {
        id: true,
        currentLatitude: true,
        currentLongitude: true,
        isOnline: true,
        lastLocationUpdate: true,
      },
    })

    await syncRiderLocationToSocket({
      riderId: rider.id,
      orderId: body.orderId || null,
      latitude,
      longitude,
      heading,
      speed,
      isOnline: isOnlineBool,
    })

    return NextResponse.json({ success: true, rider })
  } catch (error: any) {
    console.error("[API] Rider location update error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update location" },
      { status: 500 }
    )
  }
}
