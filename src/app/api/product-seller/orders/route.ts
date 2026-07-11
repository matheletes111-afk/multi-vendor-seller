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

  const orderNumber = searchParams.get("orderNumber")
  const customerName = searchParams.get("customerName")
  const email = searchParams.get("email")
  const productName = searchParams.get("productName")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const status = searchParams.get("status")

  const where: any = {
    items: {
      some: {
        sellerId: seller.id,
        productId: { not: null },
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

  if (productName) {
    where.items.some.OR = [
      { productNameSnapshot: { contains: productName, mode: "insensitive" } },
      { product: { name: { contains: productName, mode: "insensitive" } } },
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

  if (status) {
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
          where: { sellerId: seller.id, productId: { not: null } },
          include: {
            product: true,
            service: true,
            productVariant: { select: { returnType: true } },
            returnRequest: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  const serialized = orders.map((order) => {
    const sellerSubtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
    let sellerCouponDiscount = 0
    if (order.couponDiscount && order.subtotal > 0) {
      sellerCouponDiscount = Number(((order.couponDiscount * sellerSubtotal) / order.subtotal).toFixed(2))
    }
    return {
      ...order,
      status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
      totalAmount: Math.max(0, order.items.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0) - sellerCouponDiscount),
      subtotal: sellerSubtotal,
      tax: order.items.reduce((sum, item) => sum + item.gstAmount, 0),
      shipping: order.items.reduce((sum, item) => sum + item.shippingAmount, 0),
      commission: order.items.reduce((sum, item) => sum + item.commissionAmount, 0),
      couponDiscount: sellerCouponDiscount,
      hasReturnFlag: order.items.some(
        (item) =>
          item.productVariant?.returnType === "RETURNABLE" &&
          (item.returnRequest?.status === "REQUESTED" || item.returnRequest?.status === "ACCEPTED")
      ),
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
