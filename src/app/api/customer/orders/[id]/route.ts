import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { OrderDetailApi, OrderDetailItemApi } from "../types"
import { getSellerSubscription, canReceiveReviews } from "@/lib/subscriptions"
import { deriveOrderStatus, summarizeSellerItemStatuses } from "@/lib/order-status"
import { parseReturnImagesJson } from "@/lib/return-request-validation"

/** GET /api/customer/orders/[id] — get one order for current customer. CUSTOMER only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id: orderId } = await params

  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: session.user.id },
    include: {
      seller: { include: { store: true } },
      items: {
        include: {
          seller: { include: { store: { select: { name: true } } } },
          product: { select: { images: true } },
          productVariant: {
            select: { images: true, returnType: true, returnDays: true, replacementAllowed: true },
          },
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
          returnRequest: {
            select: {
              status: true,
              reason: true,
              returnImages: true,
              pickupStatus: true,
              refundStatus: true,
              resolutionType: true,
              replacementOrderItemId: true,
              exchangeTopUpAmount: true,
              exchangeTopUpStatus: true,
              exchangeRefundDifferenceAmount: true,
              exchangeRefundDifferenceStatus: true,
            },
          },
          statusHistory: {
            select: {
              status: true,
              location: true,
              note: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
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

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
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

  const sellerIds = [...new Set(order.items.map((item) => item.sellerId).filter((v): v is string => !!v))]
  const sellerReviewEnabled = new Map<string, boolean>()
  await Promise.all(
    sellerIds.map(async (sellerId) => {
      const subscription = await getSellerSubscription(sellerId)
      sellerReviewEnabled.set(sellerId, canReceiveReviews(sellerId, subscription))
    })
  )

  function toImageArray(images: unknown): string[] {
    if (Array.isArray(images)) return images.filter((v): v is string => typeof v === "string")
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images)
        if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
      } catch {
        return []
      }
    }
    return []
  }

  const items: OrderDetailItemApi[] = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null
    const variantReturnType = row.productVariant?.returnType ?? null
    const variantReturnDays = row.productVariant?.returnDays ?? null
    const returnAvailable = !!row.productId && variantReturnType === "RETURNABLE"
    const replacementAllowed =
      !!row.productId && row.productVariant?.replacementAllowed === true && returnAvailable
    const request = row.returnRequest
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
            images: toImageArray(row.review.images),
            isVerified: row.review.isVerified,
          }
        : null,
      canReview:
        row.itemStatus === "DELIVERED" &&
        (!!row.sellerId && sellerReviewEnabled.get(row.sellerId) === true) &&
        !row.review &&
        !!(row.productId || row.serviceId),
      shippingAmount: row.shippingAmount,
      returnAvailable,
      replacementAllowed,
      returnPolicyType: variantReturnType,
      returnPolicyDays: variantReturnDays,
      returnResolutionType: returnAvailable ? request?.resolutionType ?? null : null,
      replacementOrderItemId: returnAvailable ? request?.replacementOrderItemId ?? null : null,
      exchangeSourceOrderItemId: row.exchangeSourceOrderItemId ?? null,
      exchangeTopUpAmount: returnAvailable ? request?.exchangeTopUpAmount ?? 0 : 0,
      exchangeTopUpStatus: returnAvailable ? request?.exchangeTopUpStatus ?? null : null,
      exchangeRefundDifferenceAmount: returnAvailable ? request?.exchangeRefundDifferenceAmount ?? 0 : 0,
      exchangeRefundDifferenceStatus: returnAvailable ? request?.exchangeRefundDifferenceStatus ?? null : null,
      returnReason: returnAvailable ? request?.reason ?? null : null,
      returnImages: returnAvailable ? parseReturnImagesJson(request?.returnImages) : [],
      returnRequestStatus: returnAvailable ? request?.status ?? null : null,
      pickupStatus: returnAvailable ? request?.pickupStatus ?? "NOT_REQUESTED" : null,
      refundStatus: returnAvailable ? request?.refundStatus ?? "NOT_REQUESTED" : null,
      deliveryProofImage: row.deliveryProofImage ?? null,
      statusHistory: row.statusHistory.map((h) => ({
        status: h.status,
        location: h.location ?? null,
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
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
      total: 0,
      statuses: [],
      itemCount: 0,
    }
    current.subtotal += item.subtotal
    current.tax += item.gstAmount
    current.shipping += item.shippingAmount
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
        total: group.total,
      },
      itemStatuses: statusSummary.counts,
      derivedStatus: statusSummary.derivedStatus,
      itemCount: group.itemCount,
    }
  })

  const body: OrderDetailApi = {
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
    couponCode: order.couponCode,
    couponDiscount: order.couponDiscount,
  }

  return NextResponse.json(body)
}
