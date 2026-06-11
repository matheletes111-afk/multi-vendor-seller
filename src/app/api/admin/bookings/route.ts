import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const hotelId = searchParams.get("hotelId") || undefined
    const hotelSellerId = searchParams.get("hotelSellerId") || undefined
    const status = searchParams.get("status") || undefined
    const query = searchParams.get("q") || undefined
    const checkIn = searchParams.get("checkIn") || undefined
    const checkOut = searchParams.get("checkOut") || undefined

    const whereCondition = {
      hotelId: hotelId || undefined,
      status: status || undefined,
      checkIn: checkIn ? { gte: new Date(checkIn) } : undefined,
      checkOut: checkOut ? { lte: new Date(checkOut) } : undefined,
      hotel: hotelSellerId ? { hotelSellerId } : undefined,
      OR: query ? [
        { guestName: { contains: query, mode: "insensitive" as const } },
        { guestPhone: { contains: query, mode: "insensitive" as const } },
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
          room: true,
          hotel: true,
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
    console.error("Error fetching admin hotel bookings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
