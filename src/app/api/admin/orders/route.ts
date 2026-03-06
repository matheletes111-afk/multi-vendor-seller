import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import type { AdminOrderListItemApi } from "./types"

/** GET /api/admin/orders — list all orders. ADMIN only. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    include: {
      customer: { select: { name: true, email: true } },
      seller: { include: { store: { select: { name: true } } } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const result: AdminOrderListItemApi[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: o.totalAmount,
    commission: o.commission,
    commissionRate: o.commissionRate,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customer?.name ?? null,
    customerEmail: o.customer?.email ?? null,
    sellerStoreName: o.seller?.store?.name ?? null,
    itemCount: o.items.length,
  }))

  return NextResponse.json(result)
}
