import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isRestaurantSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, netBalance: true },
  })
  if (!seller) {
    return NextResponse.json({ error: "Restaurant seller not found" }, { status: 404 })
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
}
