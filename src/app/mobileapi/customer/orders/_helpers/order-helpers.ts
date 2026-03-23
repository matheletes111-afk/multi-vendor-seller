import { prisma } from "@/lib/prisma"
import type { OrderDetailApi } from "@/app/api/customer/orders/types"
import { deriveOrderStatus, summarizeSellerItemStatuses } from "@/lib/order-status"
import { getSellerSubscription, canReceiveReviews } from "@/lib/subscriptions"

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
          seller: { include: { store: { select: { name: true } } } },
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
        sellerId: row.sellerId,
        sellerStoreName: row.seller?.store?.name ?? null,
        itemStatus: row.itemStatus,
        productId: row.productId,
        serviceId: row.serviceId,
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
        review: null,
        canReview: false,
        shippingAmount: row.shippingAmount,
        commissionAmount: row.commissionAmount,
        commissionRateSnapshot: row.commissionRateSnapshot,
      }
    })

    const sellerGroupMap = new Map<
      string,
      {
        sellerId: string | null
        sellerStoreName: string | null
        subtotal: number
        tax: number
        shipping: number
        commission: number
        total: number
        statuses: import("@prisma/client").OrderStatus[]
        itemCount: number
      }
    >()
    for (const item of order.items) {
      const key = item.sellerId ?? "unknown"
      const current = sellerGroupMap.get(key) ?? {
        sellerId: item.sellerId ?? null,
        sellerStoreName: item.seller?.store?.name ?? null,
        subtotal: 0,
        tax: 0,
        shipping: 0,
        commission: 0,
        total: 0,
        statuses: [],
        itemCount: 0,
      }
      current.subtotal += item.subtotal
      current.tax += item.gstAmount
      current.shipping += item.shippingAmount
      current.commission += item.commissionAmount
      current.total += (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount
      current.statuses.push(item.itemStatus)
      current.itemCount += 1
      sellerGroupMap.set(key, current)
    }
    const sellerGroups = [...sellerGroupMap.values()].map((group) => {
      const statusSummary = summarizeSellerItemStatuses(group.statuses)
      return {
        sellerId: group.sellerId,
        sellerStoreName: group.sellerStoreName,
        summary: {
          subtotal: group.subtotal,
          tax: group.tax,
          shipping: group.shipping,
          commission: group.commission,
          total: group.total,
        },
        itemStatuses: statusSummary.counts,
        derivedStatus: statusSummary.derivedStatus,
        itemCount: group.itemCount,
      }
    })

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
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
      sellerGroups,
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
          seller: { include: { store: { select: { name: true } } } },
          product: { select: { images: true } },
          productVariant: { select: { images: true } },
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
          review: {
            select: {
              id: true,
              rating: true,
              comment: true,
              images: true,
              isVerified: true,
            },
          },
        },
      },
    },
  })

  if (!order) return null

  const sellerIds = [...new Set(order.items.map((item) => item.sellerId).filter((v): v is string => !!v))]
  const sellerReviewEnabled = new Map<string, boolean>()
  await Promise.all(
    sellerIds.map(async (sellerId) => {
      const subscription = await getSellerSubscription(sellerId)
      sellerReviewEnabled.set(sellerId, canReceiveReviews(sellerId, subscription))
    })
  )

  const items = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null

    return {
      id: row.id,
      sellerId: row.sellerId,
      sellerStoreName: row.seller?.store?.name ?? null,
      itemStatus: row.itemStatus,
      productId: row.productId,
      serviceId: row.serviceId,
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
      review: row.review
        ? {
            id: row.review.id,
            rating: row.review.rating,
            comment: row.review.comment,
            images: Array.isArray(row.review.images)
              ? row.review.images.filter((v): v is string => typeof v === "string")
              : [],
            isVerified: row.review.isVerified,
          }
        : null,
      canReview:
        row.itemStatus === "DELIVERED" &&
        (!!row.sellerId && sellerReviewEnabled.get(row.sellerId) === true) &&
        !row.review &&
        !!(row.productId || row.serviceId),
      shippingAmount: row.shippingAmount,
      commissionAmount: row.commissionAmount,
      commissionRateSnapshot: row.commissionRateSnapshot,
    }
  })

  const sellerGroupMap = new Map<
    string,
    {
      sellerId: string | null
      sellerStoreName: string | null
      subtotal: number
      tax: number
      shipping: number
      commission: number
      total: number
      statuses: import("@prisma/client").OrderStatus[]
      itemCount: number
    }
  >()
  for (const item of order.items) {
    const key = item.sellerId ?? "unknown"
    const current = sellerGroupMap.get(key) ?? {
      sellerId: item.sellerId ?? null,
      sellerStoreName: item.seller?.store?.name ?? null,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      commission: 0,
      total: 0,
      statuses: [],
      itemCount: 0,
    }
    current.subtotal += item.subtotal
    current.tax += item.gstAmount
    current.shipping += item.shippingAmount
    current.commission += item.commissionAmount
    current.total += (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount
    current.statuses.push(item.itemStatus)
    current.itemCount += 1
    sellerGroupMap.set(key, current)
  }
  const sellerGroups = [...sellerGroupMap.values()].map((group) => {
    const statusSummary = summarizeSellerItemStatuses(group.statuses)
    return {
      sellerId: group.sellerId,
      sellerStoreName: group.sellerStoreName,
      summary: {
        subtotal: group.subtotal,
        tax: group.tax,
        shipping: group.shipping,
        commission: group.commission,
        total: group.total,
      },
      itemStatuses: statusSummary.counts,
      derivedStatus: statusSummary.derivedStatus,
      itemCount: group.itemCount,
    }
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
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
    sellerGroups,
    items,
  }
}

