import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = 'force-dynamic'

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
      where: { userId },
      select: { id: true, netBalance: true },
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Hotel seller not found" }, { status: 404 })
    }

    const [rows, creditsAgg, debitsAgg] = await Promise.all([
      prisma.hotelBalanceTransaction.findMany({
        where: { hotelSellerId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          booking: {
            select: {
              guestName: true,
              hotel: { select: { name: true } },
              room: { select: { name: true } },
            }
          }
        }
      }),
      prisma.hotelBalanceTransaction.aggregate({
        where: { hotelSellerId: seller.id, kind: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.hotelBalanceTransaction.aggregate({
        where: { hotelSellerId: seller.id, kind: "DEBIT" },
        _sum: { amount: true },
      }),
    ])

    const transactions = rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      kind: r.kind,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      bookingId: r.bookingId,
      guestName: r.booking?.guestName ?? null,
      hotelName: r.booking?.hotel?.name ?? null,
      roomName: r.booking?.room?.name ?? null,
    }))

    const balanceCreditsTotal = Number(creditsAgg._sum.amount ?? 0)
    const balanceDebitsTotal = Number(debitsAgg._sum.amount ?? 0)

    return NextResponse.json({
      success: true,
      netBalance: Number(seller.netBalance),
      balanceCreditsTotal,
      balanceDebitsTotal,
      transactions,
    })
  } catch (error) {
    console.error("Error in mobile hotel seller revenue API:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
