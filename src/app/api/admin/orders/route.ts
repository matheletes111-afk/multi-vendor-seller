import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import type { AdminOrderListItemApi } from "./types"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { deriveOrderStatus } from "@/lib/order-status"

/** GET /api/admin/orders — list all orders (paginated). ADMIN only. */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      skip,
      take,
      include: {
        customer: { select: { name: true, email: true } },
        seller: { include: { store: { select: { name: true } } } },
        items: {
          select: {
            id: true,
            itemStatus: true,
            subtotal: true,
            gstAmount: true,
            shippingAmount: true,
            commissionAmount: true,
            subtotalInclGst: true,
            seller: { select: { store: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count(),
  ])

  const result: AdminOrderListItemApi[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: deriveOrderStatus(o.items.map((item) => item.itemStatus)),
    totalAmount: o.items.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0),
    commission: o.items.reduce((sum, item) => sum + item.commissionAmount, 0),
    commissionRate: o.commissionRate,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customer?.name ?? null,
    customerEmail: o.customer?.email ?? null,
    sellerStoreName:
      (() => {
        const names = [...new Set(o.items.map((item) => item.seller?.store?.name).filter(Boolean))]
        return names.length === 1 ? names[0] : names.length > 1 ? "Multiple sellers" : o.seller?.store?.name ?? null
      })() ?? null,
    itemCount: o.items.length,
  }))

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    orders: result,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}
