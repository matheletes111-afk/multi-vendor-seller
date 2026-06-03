import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const room = await prisma.room.findFirst({
      where: {
        id,
        isActive: true,
        isDeleted: false
      },
      include: {
        hotel: true
      }
    })

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: room })
  } catch (error) {
    console.error("Error fetching room details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
