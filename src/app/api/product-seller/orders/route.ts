import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { deriveOrderStatus } from "@/lib/order-status"

/** GET orders for current product seller (paginated). */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = { items: { some: { sellerId: seller.id, productId: { not: null } } } }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      include: {
        customer: true,
        items: {
          where: { sellerId: seller.id, productId: { not: null } },
          include: { product: true, service: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  const serialized = orders.map((order) => ({
    ...order,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
    totalAmount: order.items.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0),
    subtotal: order.items.reduce((sum, item) => sum + item.subtotal, 0),
    tax: order.items.reduce((sum, item) => sum + item.gstAmount, 0),
    shipping: order.items.reduce((sum, item) => sum + item.shippingAmount, 0),
    commission: order.items.reduce((sum, item) => sum + item.commissionAmount, 0),
  }))

  return NextResponse.json({
    orders: serialized,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}
