import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMobileRiderAuth } from "@/app/mobileapi/_helpers/rider-auth"

async function resolveRider(request: NextRequest) {
  const session = await auth()
  if (session?.user?.id && session.user.role === "RIDER") {
    return prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true, netBalance: true },
    })
  }

  const mobileAuth = await getMobileRiderAuth(request)
  if (mobileAuth.ok && mobileAuth.rider) {
    return mobileAuth.rider
  }

  return null
}

export async function GET(request: NextRequest) {
  const rider = await resolveRider(request)
  if (!rider) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [rows, creditsAgg, debitsAgg] = await Promise.all([
      prisma.riderBalanceTransaction.findMany({
        where: { riderId: rider.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          assignment: {
            select: {
              id: true,
              orderId: true,
              deliveryFee: true,
              settlementStatus: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  paymentMethod: true,
                },
              },
            },
          },
        },
      }),
      prisma.riderBalanceTransaction.aggregate({
        where: { riderId: rider.id, kind: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.riderBalanceTransaction.aggregate({
        where: { riderId: rider.id, kind: "DEBIT" },
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
      orderId: r.assignment?.order?.id || r.orderId || null,
      orderNumber: r.assignment?.order?.orderNumber || null,
      paymentMethod: r.assignment?.order?.paymentMethod || null,
      settlementStatus: r.assignment?.settlementStatus || null,
    }))

    const balanceCreditsTotal = Number(creditsAgg._sum.amount ?? 0)
    const balanceDebitsTotal = Number(debitsAgg._sum.amount ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        netBalance: Number(rider.netBalance),
        balanceCreditsTotal,
        balanceDebitsTotal,
        transactions,
      },
    })
  } catch (error: any) {
    console.error("GET /api/riderapp/balance-transactions error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load balance transactions" },
      { status: 500 }
    )
  }
}

