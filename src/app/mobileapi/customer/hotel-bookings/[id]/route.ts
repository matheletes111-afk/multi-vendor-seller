import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: bookingId } = await params
    const booking = await prisma.hotelBooking.findFirst({
      where: {
        id: bookingId,
        userId: auth.userId,
      },
      include: {
        room: true,
        hotel: true
      }
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: booking })
  } catch (error) {
    console.error("Error fetching mobile booking details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
