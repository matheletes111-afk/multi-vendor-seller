import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { getValidHotelSubscription } from "@/lib/subscriptions"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/overview
 * Get dashboard overview metrics.
 */
export async function GET(request: NextRequest) {
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
        select: { id: true, commissionRate: true, estimateHotelCount: true, estimateRoomCount: true },
      }),
      prisma.globalSetting.findFirst(),
    ])

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const [activeHotelsCount, roomsCount, totalAdClicks, subscription] = await Promise.all([
      prisma.hotel.count({
        where: { hotelSellerId: seller.id, isActive: true, isDeleted: false },
      }),
      prisma.room.count({
        where: { hotel: { hotelSellerId: seller.id }, isActive: true, isDeleted: false },
      }),
      prisma.adClick.count({
        where: { ad: { hotelSellerId: seller.id } },
      }),
      getValidHotelSubscription(seller.id),
    ])

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        commissionRate: seller.commissionRate ?? globalSetting?.baseCommission ?? 10.0,
        isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
        totalHotels: activeHotelsCount,
        totalRooms: roomsCount,
        totalAdClicks,
        estimateHotelCount: seller.estimateHotelCount,
        estimateRoomCount: seller.estimateRoomCount,
      }
    })
  } catch (error) {
    console.error("Error in mobile hotel seller overview API:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
