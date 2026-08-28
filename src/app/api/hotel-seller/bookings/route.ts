import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isHotelSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [seller, globalSetting] = await Promise.all([
      prisma.hotelSeller.findUnique({
        where: { userId: session.user.id },
        select: { id: true, commissionRate: true }
      }),
      (prisma as any).globalSetting.findFirst({
        select: { baseCommission: true, hotelBaseCommission: true }
      }) as Promise<{ baseCommission?: number; hotelBaseCommission?: number } | null>
    ])

    if (!seller) {
      return NextResponse.json({ error: "Hotel Seller not found" }, { status: 404 })
    }

    const commissionRate =
      seller.commissionRate ??
      globalSetting?.hotelBaseCommission ??
      globalSetting?.baseCommission ??
      10.0

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

    // Build where: always scope to this seller's hotels, optionally filter by specific hotel
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

    const formatted = bookings.map(b => {
      const commissionAmount = Math.round(b.totalPrice * (commissionRate / 100) * 100) / 100
      const sellerNet = Math.max(0, Math.round((b.totalPrice - commissionAmount) * 100) / 100)
      return {
        ...b,
        commissionRate,
        commissionAmount,
        sellerNet,
      }
    })

    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      success: true,
      commissionRate,
      data: formatted,
      totalCount,
      totalPages,
      page,
      perPage
    })
  } catch (error) {
    console.error("Error fetching hotel seller bookings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
