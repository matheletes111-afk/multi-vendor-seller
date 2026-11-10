import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

/** GET /api/product-seller/balance-transactions — net balance + ledger (delivered-line credits, wallet debits, exchange top-ups). */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, netBalance: true },
  })
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const [rows, creditsAgg, debitsAgg] = await Promise.all([
    prisma.sellerBalanceTransaction.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        returnRequest: {
          select: {
            orderItem: {
              select: {
                productNameSnapshot: true,
                serviceNameSnapshot: true,
                order: { select: { id: true, orderNumber: true } },
              },
            },
          },
        },
        orderItem: {
          select: {
            productNameSnapshot: true,
            serviceNameSnapshot: true,
            order: { select: { id: true, orderNumber: true } },
          },
        },
      },
    }),
    prisma.sellerBalanceTransaction.aggregate({
      where: { sellerId: seller.id, kind: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.sellerBalanceTransaction.aggregate({
      where: { sellerId: seller.id, kind: "DEBIT" },
      _sum: { amount: true },
    }),
  ])

  // Batch load any standalone orderIds that weren't linked via orderItem/returnRequest
  const standaloneOrderIds = Array.from(
    new Set(
      rows
        .filter((r) => r.orderId && !r.orderItem?.order && !r.returnRequest?.orderItem?.order)
        .map((r) => r.orderId as string)
    )
  )

  const standaloneOrders = standaloneOrderIds.length > 0
    ? await prisma.order.findMany({
        where: { id: { in: standaloneOrderIds } },
        select: { id: true, orderNumber: true },
      })
    : []
  const orderMap = new Map<string, { id: string; orderNumber: string }>()
  standaloneOrders.forEach((o) => orderMap.set(o.id, o))

  const transactions = rows.map((r) => {
    const standaloneOrder = r.orderId ? orderMap.get(r.orderId) : null
    const order = r.returnRequest?.orderItem?.order ?? r.orderItem?.order ?? standaloneOrder
    const lineName =
      r.returnRequest?.orderItem?.productNameSnapshot ??
      r.returnRequest?.orderItem?.serviceNameSnapshot ??
      r.orderItem?.productNameSnapshot ??
      r.orderItem?.serviceNameSnapshot ??
      null
    return {
      id: r.id,
      amount: Number(r.amount),
      kind: r.kind,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      orderId: order?.id ?? r.orderId ?? null,
      orderNumber: order?.orderNumber ?? null,
      orderItemProductName: lineName,
    }
  })

  const balanceCreditsTotal = Number(creditsAgg._sum.amount ?? 0)
  const balanceDebitsTotal = Number(debitsAgg._sum.amount ?? 0)

  return NextResponse.json({
    netBalance: Number(seller.netBalance),
    balanceCreditsTotal,
    balanceDebitsTotal,
    transactions,
  })
}
