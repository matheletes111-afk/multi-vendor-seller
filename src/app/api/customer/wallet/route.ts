import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

/** GET /api/customer/wallet — wallet balance + transaction history (customer only). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      walletBalance: true,
      walletTransactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          returnRequest: {
            include: {
              orderItem: {
                include: {
                  order: { select: { id: true, orderNumber: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const balance = Number(user.walletBalance)

  const transactions = user.walletTransactions.map((tx) => {
    const rr = tx.returnRequest
    const orderNumber = rr?.orderItem?.order?.orderNumber ?? null
    const orderId = rr?.orderItem?.order?.id ?? null
    const orderItemProductName = rr?.orderItem?.productNameSnapshot ?? rr?.orderItem?.serviceNameSnapshot ?? null

    return {
      id: tx.id,
      amount: Number(tx.amount),
      reason: tx.reason,
      note: tx.note,
      createdAt: tx.createdAt.toISOString(),
      orderNumber,
      orderId,
      orderItemProductName,
    }
  })

  return NextResponse.json({ balance, transactions })
}
