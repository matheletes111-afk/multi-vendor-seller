import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
      select: { id: true, netBalance: true },
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Restaurant seller not found" }, { status: 404 })
    }

    const [rows, creditsAgg, debitsAgg] = await Promise.all([
      prisma.restaurantBalanceTransaction.findMany({
        where: { restaurantSellerId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          foodOrder: {
            select: {
              orderNumber: true,
              customer: { select: { name: true } }
            }
          }
        }
      }),
      prisma.restaurantBalanceTransaction.aggregate({
        where: { restaurantSellerId: seller.id, kind: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.restaurantBalanceTransaction.aggregate({
        where: { restaurantSellerId: seller.id, kind: "DEBIT" },
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
      foodOrderId: r.foodOrderId,
      orderNumber: r.foodOrder?.orderNumber ?? null,
      customerName: r.foodOrder?.customer?.name ?? null,
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
    console.error("Error in mobile restaurant seller revenue API:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
