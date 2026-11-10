import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null
    const session = await auth()
    if (session?.user?.id && session.user.role === "CUSTOMER") {
      userId = session.user.id
    } else {
      const mobileAuth = await getMobileCustomerAuth(request)
      if (mobileAuth.ok) {
        userId = mobileAuth.userId
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
          room: { select: { id: true, name: true } },
          hotel: { select: { id: true, name: true, city: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.hotelBooking.count({ where: whereCondition })
    ])

    const totalPages = Math.ceil(totalCount / perPage)

    // Sanitize customer response to ensure commission is 100% private
    const sanitizedBookings = bookings.map((b) => ({
      id: b.id,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      numberOfRooms: b.numberOfRooms,
      adults: b.adults,
      children: b.children,
      subtotal: b.subtotal,
      couponCode: b.couponCode,
      couponDiscount: b.couponDiscount,
      totalPrice: b.totalPrice,
      status: b.status,
      paymentMethod: b.paymentMethod ?? "COD",
      paymentStatus: b.paymentStatus,
      afriTxnId: b.afriTxnId,
      paidAt: b.paidAt,
      createdAt: b.createdAt,
      room: b.room,
      hotel: b.hotel,
    }))

    return NextResponse.json({
      success: true,
      data: sanitizedBookings,
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
