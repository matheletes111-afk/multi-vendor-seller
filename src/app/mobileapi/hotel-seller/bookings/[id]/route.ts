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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  
  try {
    const [seller, globalSetting] = await Promise.all([
      prisma.hotelSeller.findUnique({
        where: { userId },
        select: { id: true, commissionRate: true }
      }),
      (prisma as any).globalSetting.findFirst({
        select: { baseCommission: true, hotelBaseCommission: true }
      }) as Promise<{ baseCommission?: number; hotelBaseCommission?: number } | null>
    ])
    if (!seller) {
      return NextResponse.json({ success: false, error: "Hotel Seller profile not found" }, { status: 404 })
    }

    const defaultCommissionRate =
      seller.commissionRate ??
      globalSetting?.hotelBaseCommission ??
      globalSetting?.baseCommission ??
      10.0

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

    const commissionRate = booking.commissionRate ?? defaultCommissionRate
    const commissionAmount = booking.commissionAmount ?? Math.round(booking.totalPrice * (commissionRate / 100) * 100) / 100
    const sellerNetPayout = booking.sellerNetPayout ?? Math.max(0, Math.round((booking.totalPrice - commissionAmount) * 100) / 100)
    const settlementStatus = booking.settlementStatus ?? (booking.status === "COMPLETED" ? "YET_TO_PAY" : "ESCROW_HELD")

    return NextResponse.json({
      success: true,
      data: {
        ...booking,
        commissionRate,
        commissionAmount,
        sellerNetPayout,
        settlementStatus,
      }
    })
  } catch (error) {
    console.error("Error fetching mobile hotel booking detail:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
