import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isHotelSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isHotelSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.hotelSeller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, netBalance: true },
  })
  if (!seller) {
    return NextResponse.json({ error: "Hotel seller not found" }, { status: 404 })
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
}
