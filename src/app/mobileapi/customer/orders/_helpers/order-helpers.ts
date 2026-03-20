import { prisma } from "@/lib/prisma"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"

export type CustomerOrderKind = "product" | "service"

function customerOrderKindFilter(kind: CustomerOrderKind) {
  return kind === "product" ? { productId: { not: null } } : { serviceId: { not: null } }
}

export async function listCustomerOrders({
  userId,
  kind,
  page,
  pageSize,
}: {
  userId: string
  kind: CustomerOrderKind
  page?: number
  pageSize?: number
}): Promise<{ orders: OrderDetailApi[]; total: number; page: number; pageSize: number }> {
  const safePage =
    typeof page === "number" && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safePageSize =
    typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10

  const where = {
    customerId: userId,
    items: {
      some: customerOrderKindFilter(kind),
    },
  }

  const total = await prisma.order.count({ where })
  const orders = await prisma.order.findMany({
    where,
    include: {
      seller: { include: { store: true } },
      items: {
        include: {
          product: { select: { images: true } },
          productVariant: { select: { images: true } },
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  })

  const mappedOrders: OrderDetailApi[] = orders.map((order) => {
    const items = order.items.map((row) => {
      const productImages = (row.product as { images?: unknown } | null)?.images
      const variantImages = (row.productVariant as { images?: unknown } | null)?.images
      const serviceImages = (row.service as { images?: unknown } | null)?.images
      const imageUrl =
        firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null

      const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null

      return {
        id: row.id,
        productNameSnapshot: row.productNameSnapshot,
        serviceNameSnapshot: row.serviceNameSnapshot,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
        hasGst: row.hasGst,
        gstAmount: row.gstAmount,
        subtotalInclGst: row.subtotalInclGst,
        imageUrl,
        serviceSlotStartTime: slot?.startTime ? slot.startTime.toISOString() : null,
        serviceSlotEndTime: slot?.endTime ? slot.endTime.toISOString() : null,
      }
    })

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shipping,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingFullName: order.shippingFullName,
      shippingPhone: order.shippingPhone,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      createdAt: order.createdAt.toISOString(),
      sellerStoreName: order.seller?.store?.name ?? null,
      items,
    }
  })

  return { orders: mappedOrders, total, page: safePage, pageSize: safePageSize }
}

function firstImageUrl(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0]
  if (typeof images === "string") return images
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") return parsed[0]
  } catch {
    /* ignore */
  }
  return null
}

export async function getCustomerOrderDetail({
  userId,
  orderId,
  kind,
}: {
  userId: string
  orderId: string
  kind: CustomerOrderKind
}): Promise<OrderDetailApi | null> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
      items: {
        some: customerOrderKindFilter(kind),
      },
    },
    include: {
      seller: { include: { store: true } },
      items: {
        include: {
          product: { select: { images: true } },
          productVariant: { select: { images: true } },
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
        },
      },
    },
  })

  if (!order) return null

  // Keep the full `items` array (both product + service) like web does.
  const items = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null

    return {
      id: row.id,
      productNameSnapshot: row.productNameSnapshot,
      serviceNameSnapshot: row.serviceNameSnapshot,
      quantity: row.quantity,
      price: row.price,
      subtotal: row.subtotal,
      hasGst: row.hasGst,
      gstAmount: row.gstAmount,
      subtotalInclGst: row.subtotalInclGst,
      imageUrl,
      serviceSlotStartTime: slot?.startTime ? slot.startTime.toISOString() : null,
      serviceSlotEndTime: slot?.endTime ? slot.endTime.toISOString() : null,
    }
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingFullName: order.shippingFullName,
    shippingPhone: order.shippingPhone,
    shippingAddressLine1: order.shippingAddressLine1,
    shippingAddressLine2: order.shippingAddressLine2,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
    createdAt: order.createdAt.toISOString(),
    sellerStoreName: order.seller?.store?.name ?? null,
    items,
  }
}

