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
    perPage: searchParams.get("perPage") ?? "10",
  })

  const sellerQuery = searchParams.get("seller")
  const customerQuery = searchParams.get("customer")
  const statusQuery = searchParams.get("status")
  const typeQuery = searchParams.get("type")?.toUpperCase() // 'PRODUCT' or 'SERVICE'

  const where: any = {}

  if (typeQuery === "PRODUCT") {
    where.items = {
      some: { productNameSnapshot: { not: null } },
    }
  } else if (typeQuery === "SERVICE") {
    where.items = {
      some: { serviceNameSnapshot: { not: null } },
    }
  }

  if (customerQuery) {
    where.customer = {
      name: { contains: customerQuery, mode: "insensitive" },
    }
  }

  if (sellerQuery) {
    where.items = {
      some: {
        seller: {
          store: {
            name: { contains: sellerQuery, mode: "insensitive" },
          },
        },
      },
    }
  }

  if (statusQuery && statusQuery !== "null") {
    // Making status filter "accurate" by ensuring all items match the selected status
    // for terminal states, or matching the order record's status if that's the source.
    // Given the UI uses deriveOrderStatus, we filter by items to be most accurate.
    where.items = {
      every: { itemStatus: statusQuery as any }
    }
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
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
            productNameSnapshot: true,
            serviceNameSnapshot: true,
            quantity: true,
            price: true,
            seller: { select: { store: { select: { name: true } } } },
            product: { select: { images: true } },
            service: { select: { images: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ])

  const result: AdminOrderListItemApi[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: deriveOrderStatus(o.items.map((item) => item.itemStatus)),
    totalAmount: o.totalAmount,
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
    items: o.items.map(item => {
      let imageUrl: string | null = null
      if (item.product?.images) {
        const imgs = item.product.images as any
        imageUrl = Array.isArray(imgs) ? imgs[0] : imgs
      } else if (item.service?.images) {
        const imgs = item.service.images as any
        imageUrl = Array.isArray(imgs) ? imgs[0] : imgs
      }
      return {
        id: item.id,
        productName: item.productNameSnapshot,
        serviceName: item.serviceNameSnapshot,
        quantity: item.quantity,
        price: Number(item.price),
        status: item.itemStatus,
        imageUrl
      }
    })
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
