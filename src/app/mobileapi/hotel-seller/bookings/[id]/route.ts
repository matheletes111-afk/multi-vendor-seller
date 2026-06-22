import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/bookings/[id]
 * Get details of a single booking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const bookingId = params.id

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Hotel Seller profile not found" }, { status: 404 })
    }

    const booking = await prisma.hotelBooking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        hotel: true,
        user: { select: { id: true, name: true, email: true, phone: true } }
      }
    })

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    // Verify booking belongs to this seller's hotel
    if (booking.hotel.hotelSellerId !== seller.id) {
      return NextResponse.json({ success: false, error: "Unauthorized access to this booking" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: booking
    })
  } catch (error) {
    console.error("Error fetching mobile hotel booking detail:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
