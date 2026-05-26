import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"
import { getValidHotelSubscription } from "@/lib/subscriptions"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isHotelSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [seller, globalSetting] = await Promise.all([
      prisma.hotelSeller.findUnique({
        where: { userId: session.user.id },
        select: { id: true, commissionRate: true, estimateHotelCount: true, estimateRoomCount: true },
      }),
      prisma.globalSetting.findFirst(),
    ])

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
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
      subscription,
      commissionRate: seller.commissionRate ?? globalSetting?.baseCommission ?? 10.0,
      isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
      totalHotels: activeHotelsCount,
      totalRooms: roomsCount,
      totalAdClicks,
      estimateHotelCount: seller.estimateHotelCount,
      estimateRoomCount: seller.estimateRoomCount,
    })
  } catch (error) {
    console.error("Error in hotel seller overview API:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
