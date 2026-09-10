import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        isOnline: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationUpdate: true,
      },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, rider })
  } catch (error: any) {
    console.error("[API] Rider status GET error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch status" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const isOnline = Boolean(body.isOnline)

    const rider = await prisma.rider.update({
      where: { userId: session.user.id },
      data: {
        isOnline,
        lastLocationUpdate: new Date(),
      },
      select: {
        id: true,
        isOnline: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationUpdate: true,
      },
    })

    return NextResponse.json({ success: true, rider })
  } catch (error: any) {
    console.error("[API] Rider status update error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update status" },
      { status: 500 }
    )
  }
}
