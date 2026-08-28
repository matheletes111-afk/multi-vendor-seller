import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { latitude, longitude, heading, speed, isOnline } = body

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "latitude and longitude are required" },
        { status: 400 }
      )
    }

    const rider = await prisma.rider.update({
      where: { userId: session.user.id },
      data: {
        currentLatitude: Number(latitude),
        currentLongitude: Number(longitude),
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

    return NextResponse.json({ success: true, rider })
  } catch (error: any) {
    console.error("[API] Rider location update error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update location" },
      { status: 500 }
    )
  }
}
