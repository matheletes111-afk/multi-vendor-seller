import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = auth.userId
    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const status = searchParams.get("status") || undefined
    const query = searchParams.get("q") || undefined
    const hotelId = searchParams.get("hotelId") || undefined
    const checkIn = searchParams.get("checkIn") || undefined
    const checkOut = searchParams.get("checkOut") || undefined

    const whereCondition = {
      userId,
      status: status || undefined,
      hotelId: hotelId || undefined,
      checkIn: checkIn ? { gte: new Date(checkIn) } : undefined,
      checkOut: checkOut ? { lte: new Date(checkOut) } : undefined,
      OR: query ? [
        { hotel: { name: { contains: query, mode: "insensitive" as const } } },
        { room: { name: { contains: query, mode: "insensitive" as const } } }
      ] : undefined
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.hotelBooking.findMany({
        where: whereCondition,
        skip,
        take,
        include: {
          room: { select: { id: true, name: true, price: true, capacityAdults: true, capacityChildren: true, images: true, amenities: true } },
          hotel: { select: { id: true, name: true, city: true, address: true, images: true, starRating: true } }
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
    console.error("Error fetching mobile customer hotel bookings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
