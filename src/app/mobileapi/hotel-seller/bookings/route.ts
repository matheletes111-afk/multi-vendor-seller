import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/bookings
 * Get bookings list with pagination and filters.
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
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Hotel Seller profile not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const hotelId = searchParams.get("hotelId") || undefined
    const status = searchParams.get("status") || undefined
    const query = searchParams.get("q") || undefined
    const checkIn = searchParams.get("checkIn") || undefined
    const checkOut = searchParams.get("checkOut") || undefined

    // Build where: scope to this seller's hotels, optionally filter
    const whereCondition = {
      hotel: {
        hotelSellerId: seller.id,
        ...(hotelId ? { id: hotelId } : {}),
      },
      status: status || undefined,
      checkIn: checkIn ? { gte: new Date(checkIn) } : undefined,
      checkOut: checkOut ? { lte: new Date(checkOut) } : undefined,
      OR: query ? [
        { guestName: { contains: query, mode: "insensitive" as const } },
        { guestPhone: { contains: query, mode: "insensitive" as const } }
      ] : undefined
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.hotelBooking.findMany({
        where: whereCondition,
        skip,
        take,
        include: {
          room: { select: { id: true, name: true } },
          hotel: { select: { id: true, name: true, city: true } },
          user: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.hotelBooking.count({ where: whereCondition })
    ])

    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      success: true,
      data: bookings,
      totalCount,
      totalPages,
      page,
      perPage
    })
  } catch (error) {
    console.error("Error fetching mobile hotel seller bookings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
