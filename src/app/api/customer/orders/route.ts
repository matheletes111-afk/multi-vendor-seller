import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { deriveOrderStatus } from "@/lib/order-status"

/** GET /api/customer/orders — paginated orders for current customer. type=product | service (Web & Mobile) */
export async function GET(request: NextRequest) {
  let customerId: string | null = null
  const session = await auth()
  if (session?.user?.id && session.user.role === UserRole.CUSTOMER) {
    customerId = session.user.id
  } else {
    const mobileAuth = await getMobileCustomerAuth(request)
    if (mobileAuth.ok) {
      customerId = mobileAuth.userId
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })
  const typeRaw = searchParams.get("type")
  const type = typeRaw === "service" ? "service" : "product"

  const baseWhere = { customerId }
  const productWhere = {
    ...baseWhere,
    items: { some: { productId: { not: null } } },
  }
  const serviceWhere = {
    ...baseWhere,
    items: { some: { serviceId: { not: null } } },
  }
  const listWhere = type === "service" ? serviceWhere : productWhere

  const [orders, totalCount, tabCounts] = await Promise.all([
    prisma.order.findMany({
      where: listWhere,
      skip,
      take,
      include: {
        items: {
          select: {
            id: true,
            sellerId: true,
            itemStatus: true,
            productId: true,
            serviceId: true,
            productVariantId: true,
            productNameSnapshot: true,
            serviceNameSnapshot: true,
            quantity: true,
            subtotal: true,
            productVariant: {
              select: {
                returnType: true,
                returnDays: true,
                replacementAllowed: true,
              },
            },
            seller: { select: { store: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where: listWhere }),
    Promise.all([
      prisma.order.count({ where: productWhere }),
      prisma.order.count({ where: serviceWhere }),
    ]).then(([product, service]) => ({ product, service })),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  const serializedOrders = orders.map((order) => {
    const relevantItems =
      type === "service" ? order.items.filter((i) => i.serviceId != null) : order.items.filter((i) => i.productId != null)
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      afriTxnId: order.afriTxnId ?? null,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      status: deriveOrderStatus(relevantItems.map((item) => item.itemStatus)),
      seller: {
        store: {
          name:
            (() => {
              const names = [
                ...new Set(relevantItems.map((item) => item.seller?.store?.name).filter(Boolean)),
              ]
              return names.length === 1 ? names[0] : names.length > 1 ? "Multiple sellers" : "Store"
            })() ?? "Store",
        },
      },
      items: relevantItems.map((item) => ({
        id: item.id,
        sellerId: item.sellerId,
        itemStatus: item.itemStatus,
        productId: item.productId,
        serviceId: item.serviceId,
        productVariantId: item.productVariantId,
        productNameSnapshot: item.productNameSnapshot,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
        subtotal: item.subtotal,
        returnPolicyType: item.productVariant?.returnType ?? null,
        returnPolicyDays: item.productVariant?.returnDays ?? null,
        replacementAllowed: item.productVariant?.replacementAllowed === true,
      })),
    }
  })

  return NextResponse.json({
    orders: serializedOrders,
    totalCount,
    totalPages,
    page,
    perPage,
    type,
    tabCounts,
  })
}
