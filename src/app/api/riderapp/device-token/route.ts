import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { token, platform, userAgent } = body as {
      token?: string
      platform?: string
      userAgent?: string
    }

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const cleanToken = token.trim()
    const cleanPlatform = platform || "web_laptop"
    const now = new Date().toISOString()

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true, deviceTokens: true },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 })
    }

    let existingTokens: Array<{
      token: string
      platform: string
      userAgent?: string
      lastActiveAt: string
    }> = []

    if (Array.isArray(rider.deviceTokens)) {
      existingTokens = rider.deviceTokens as any
    }

    // Filter out existing matching token and append updated entry
    const filtered = existingTokens.filter((item) => item.token !== cleanToken)
    filtered.push({
      token: cleanToken,
      platform: cleanPlatform,
      userAgent: userAgent?.slice(0, 200),
      lastActiveAt: now,
    })

    // Keep up to 10 latest active devices
    const updatedTokens = filtered.slice(-10)

    await prisma.rider.update({
      where: { id: rider.id },
      data: {
        deviceTokens: updatedTokens,
      },
    })

    return NextResponse.json({
      success: true,
      deviceTokens: updatedTokens,
    })
  } catch (error) {
    console.error("Device token update error:", error)
    return NextResponse.json(
      { error: "Failed to update device token." },
      { status: 500 }
    )
  }
}
