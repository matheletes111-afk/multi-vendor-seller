import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import type {
  PatchOrderStatusPayload,
  SellerOrderDetailApi,
  SellerOrderDetailItemApi,
} from "../types"
import { SELLER_ORDER_STATUSES } from "../types"
import { deriveOrderStatus } from "@/lib/order-status"

function isValidSellerStatus(s: string): s is PatchOrderStatusPayload["status"] {
  return SELLER_ORDER_STATUSES.includes(s as PatchOrderStatusPayload["status"])
}

/** GET /api/product-seller/orders/[id] — get one order for current product seller. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, productId: { not: null } } } },
    include: {
      customer: true,
      items: {
        where: { sellerId: seller.id, productId: { not: null } },
        include: {
          product: { select: { images: true } },
          productVariant: { select: { images: true, returnType: true } },
          service: { select: { images: true } },
          returnRequest: {
            select: {
              status: true,
              pickupStatus: true,
              refundStatus: true,
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
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

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

  const items: SellerOrderDetailItemApi[] = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const returnAvailable = row.productVariant?.returnType === "RETURNABLE"
    return {
      id: row.id,
      itemStatus: row.itemStatus,
      productNameSnapshot: row.productNameSnapshot,
      serviceNameSnapshot: row.serviceNameSnapshot,
      quantity: row.quantity,
      price: row.price,
      subtotal: row.subtotal,
      hasGst: row.hasGst,
      gstAmount: row.gstAmount,
      subtotalInclGst: row.subtotalInclGst,
      imageUrl,
      returnAvailable,
      returnRequestStatus: row.returnRequest?.status ?? null,
      pickupStatus: row.returnRequest?.pickupStatus ?? (returnAvailable ? "NOT_REQUESTED" : null),
      refundStatus: row.returnRequest?.refundStatus ?? (returnAvailable ? "NOT_REQUESTED" : null),
      deliveryProofImage: row.deliveryProofImage ?? null,
      statusHistory: row.statusHistory.map((h) => ({
        status: h.status,
        location: h.location ?? null,
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
    }
  })

  const body: SellerOrderDetailApi = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
    totalAmount: order.items.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0),
    subtotal: order.items.reduce((sum, item) => sum + item.subtotal, 0),
    tax: order.items.reduce((sum, item) => sum + item.gstAmount, 0),
    shipping: order.items.reduce((sum, item) => sum + item.shippingAmount, 0),
    commission: order.items.reduce((sum, item) => sum + item.commissionAmount, 0),
    commissionRate: order.commissionRate,
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
    customerName: order.customer?.name ?? null,
    customerEmail: order.customer?.email ?? null,
    items,
  }
  return NextResponse.json(body)
}

/** PATCH /api/product-seller/orders/[id] — update order status. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, productId: { not: null } } } },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as PatchOrderStatusPayload & {
    deliveryProofImage?: string
    location?: string
    note?: string
  }
  const status = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : null
  const deliveryProofImage =
    typeof payload.deliveryProofImage === "string" ? payload.deliveryProofImage.trim() : ""
  const location = typeof payload.location === "string" ? payload.location.trim() : ""
  const note = typeof payload.note === "string" ? payload.note.trim() : ""
  const itemId = typeof (body as { itemId?: string }).itemId === "string" ? (body as { itemId?: string }).itemId : null
  const itemIds = Array.isArray((body as { itemIds?: string[] }).itemIds)
    ? (body as { itemIds?: string[] }).itemIds!.filter((v): v is string => typeof v === "string")
    : []
  if (!status || !isValidSellerStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + SELLER_ORDER_STATUSES.join(", ") },
      { status: 400 }
    )
  }
  const targetItemIds = [...new Set([...(itemId ? [itemId] : []), ...itemIds])]
  if (targetItemIds.length === 0) {
    return NextResponse.json({ error: "itemId or itemIds is required for item-level status update" }, { status: 400 })
  }

  const ownItems = await prisma.orderItem.findMany({
    where: { orderId, id: { in: targetItemIds }, sellerId: seller.id, productId: { not: null } },
    select: { id: true, itemStatus: true },
  })
  if (ownItems.length !== targetItemIds.length) {
    return NextResponse.json({ error: "One or more items are not found for this seller" }, { status: 404 })
  }
  if (ownItems.some((row) => row.itemStatus === "CANCELLED" || row.itemStatus === "REFUNDED")) {
    return NextResponse.json({ error: "Cannot change cancelled or refunded item status" }, { status: 400 })
  }
  if (status === "CANCELLED" && ownItems.some((row) => row.itemStatus !== "PENDING")) {
    return NextResponse.json({ error: "Can only cancel items that are PENDING" }, { status: 400 })
  }
  if (status === "DELIVERED" && !deliveryProofImage) {
    return NextResponse.json({ error: "Delivery proof image is required when marking delivered" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({
      where: { id: { in: targetItemIds }, orderId, sellerId: seller.id, productId: { not: null } },
      data:
        status === "DELIVERED"
          ? { itemStatus: status, deliveredAt: new Date(), deliveryProofImage }
          : { itemStatus: status },
    })
    await tx.orderItemStatusHistory.createMany({
      data: targetItemIds.map((id) => ({
        orderItemId: id,
        status: status as import("@prisma/client").OrderStatus,
        location: location || null,
        note: note || null,
      })),
    })
  })
  return NextResponse.json({ success: true, status, updatedItemIds: targetItemIds })
}
