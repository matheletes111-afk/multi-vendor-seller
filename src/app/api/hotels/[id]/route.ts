import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const hotel = await prisma.hotel.findFirst({
      where: {
        id,
        isActive: true,
        isDeleted: false,
        hotelSeller: {
          isApproved: true,
          isSuspended: false,
        }
      },
      include: {
        rooms: {
          where: { isActive: true, isDeleted: false },
          orderBy: { price: "asc" }
        }
      }
    })

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: hotel })
  } catch (error) {
    console.error("Error fetching hotel details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
