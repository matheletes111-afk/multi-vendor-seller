import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const status = searchParams.get("status") || undefined
    const query = searchParams.get("q") || undefined

    const whereCondition = {
      userId: session.user.id,
      status: status || undefined,
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
          room: { select: { id: true, name: true } },
          hotel: { select: { id: true, name: true, city: true } }
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
    console.error("Error fetching customer hotel bookings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
