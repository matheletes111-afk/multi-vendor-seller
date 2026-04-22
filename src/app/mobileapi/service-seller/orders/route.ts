import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { deriveOrderStatus } from "@/lib/order-status"

/** GET orders for current service seller (mobile). */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
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

  const orderNumber = searchParams.get("orderNumber")
  const customerName = searchParams.get("customerName")
  const email = searchParams.get("email")
  const serviceName = searchParams.get("serviceName")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const status = searchParams.get("status")

  const where: any = {
    items: {
      some: {
        sellerId: seller.id,
        serviceId: { not: null },
      },
    },
  }

  if (orderNumber) {
    const cleanOrderNumber = orderNumber.startsWith("#") ? orderNumber.slice(1) : orderNumber
    where.orderNumber = { contains: cleanOrderNumber, mode: "insensitive" }
  }

  if (customerName || email) {
    where.customer = {}
    if (customerName) {
      where.customer.name = { contains: customerName, mode: "insensitive" }
    }
    if (email) {
      where.customer.email = { contains: email, mode: "insensitive" }
    }
  }

  if (serviceName) {
    where.items.some.OR = [
      { serviceNameSnapshot: { contains: serviceName, mode: "insensitive" } },
      { service: { name: { contains: serviceName, mode: "insensitive" } } },
    ]
  }

  if (startDate || endDate) {
    const dateFilter: any = {}
    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) {
        dateFilter.gte = start
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter
    }
  }

  if (status && status !== "ALL") {
    where.items.some.itemStatus = status
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      include: {
        customer: true,
        items: {
          where: { sellerId: seller.id, serviceId: { not: null } },
          include: {
            service: { select: { images: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  function firstImageUrl(images: unknown): string | null {
    if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0]
    if (typeof images === "string") return images
    try {
      const parsed = typeof images === "string" ? JSON.parse(images) : images
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") return parsed[0]
    } catch { /* ignore */ }
    return null
  }

  const serialized = orders.map((order) => {
    const sellerItems = order.items
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: deriveOrderStatus(sellerItems.map((item) => item.itemStatus)),
      totalAmount: sellerItems.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0),
      createdAt: order.createdAt,
      customer: {
        name: order.customer?.name ?? null,
        email: order.customer?.email ?? null,
      },
      items: sellerItems.map(item => {
        const imageUrl = firstImageUrl(item.service?.images) ?? null
        return {
          id: item.id,
          serviceNameSnapshot: item.serviceNameSnapshot,
          quantity: item.quantity,
          price: item.price,
          imageUrl,
          status: item.itemStatus
        }
      })
    }
  })

  return NextResponse.json({
    orders: serialized,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}
