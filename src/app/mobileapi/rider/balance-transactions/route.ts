import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authStatus = await getMobileRiderAuth(request)
  if (!authStatus.ok || !authStatus.rider) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const rider = await prisma.rider.findUnique({
      where: { id: authStatus.rider.id },
      select: { id: true, netBalance: true },
    })

    if (!rider) {
      return NextResponse.json({ success: false, error: "Rider not found" }, { status: 404 })
    }

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
    console.error("[Mobile API] Rider balance-transactions error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load balance transactions" },
      { status: 500 }
    )
  }
}

