import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { deriveOrderStatus } from "@/lib/order-status"
import { SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS } from "@/app/api/service-seller/orders/types"
import { releaseServiceSlotsForOrderItems } from "@/lib/release-service-slot"
import { serviceSellerItemsNet } from "@/lib/service-seller-order-money"
import {
  getOrderHasDeliveredLine,
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"
import { applySellerCreditForOrderLineDelivered } from "@/lib/seller-order-line-settlement"
import { OrderStatus } from "@prisma/client"

function isValidServiceSellerItemStatus(s: string): boolean {
  return (SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS as readonly string[]).includes(s)
}

/** GET /mobileapi/service-seller/orders/[id] — get one service order for mobile. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, serviceId: { not: null } } } },
    include: {
      customer: true,
      items: {
        where: { sellerId: seller.id, serviceId: { not: null } },
        include: {
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
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
    } catch { /* ignore */ }
    return null
  }

  const items = order.items.map((row) => {
    const imageUrl = firstImageUrl(row.service?.images) ?? null
    const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null
    return {
      id: row.id,
      itemStatus: row.itemStatus,
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
      deliveryProofImage: row.deliveryProofImage ?? null,
      statusHistory: row.statusHistory.map((h) => ({
        status: h.status,
        location: h.location ?? null,
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
    }
  })

  const sellerItems = order.items
  const totalAmount = sellerItems.reduce(
    (sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount,
    0
  )
  const commission = sellerItems.reduce((sum, item) => sum + item.commissionAmount, 0)
  const sellerNet = serviceSellerItemsNet(sellerItems)
  const orderHasDeliveredLine = await getOrderHasDeliveredLine(prisma, order.id)

  const body = {
    id: order.id,
    orderNumber: order.orderNumber,
    orderHasDeliveredLine,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
    totalAmount,
    subtotal: order.items.reduce((sum, item) => sum + item.subtotal, 0),
    tax: order.items.reduce((sum, item) => sum + item.gstAmount, 0),
    shipping: order.items.reduce((sum, item) => sum + item.shippingAmount, 0),
    commission,
    sellerNet,
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
    customer: {
      name: order.customer?.name ?? null,
      email: order.customer?.email ?? null,
      phone: order.customer?.phone ?? null,
    },
    items,
  }
  return NextResponse.json(body)
}

/** PATCH /mobileapi/service-seller/orders/[id] — update order status. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, serviceId: { not: null } } } },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as {
    status: string
    deliveryProofImage?: string
    location?: string
    note?: string
    itemId?: string
    itemIds?: string[]
  }
  const status = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : null
  const deliveryProofImage =
    typeof payload.deliveryProofImage === "string" ? payload.deliveryProofImage.trim() : ""
  const location = typeof payload.location === "string" ? payload.location.trim() : ""
  const note = typeof payload.note === "string" ? payload.note.trim() : ""
  const itemId = typeof payload.itemId === "string" ? payload.itemId : null
  const itemIds = Array.isArray(payload.itemIds)
    ? payload.itemIds.filter((v): v is string => typeof v === "string")
    : []

  if (!status || !isValidServiceSellerItemStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS.join(", ") },
      { status: 400 }
    )
  }
  const targetItemIds = [...new Set([...(itemId ? [itemId] : []), ...itemIds])]
  if (targetItemIds.length === 0) {
    return NextResponse.json({ error: "itemId or itemIds is required" }, { status: 400 })
  }

  const ownItems = await prisma.orderItem.findMany({
    where: { orderId, id: { in: targetItemIds }, sellerId: seller.id, serviceId: { not: null } },
    select: { id: true, itemStatus: true },
  })
  if (ownItems.length !== targetItemIds.length) {
    return NextResponse.json({ error: "One or more items are not found" }, { status: 404 })
  }

  // Prev status check (Backward movement protection)
  const STATUS_PRIORITY: Record<string, number> = {
    PENDING: 10,
    CONFIRMED: 20,
    DELIVERED: 50,
    CANCELLED: 60,
  }

  for (const item of ownItems) {
    const currentPriority = STATUS_PRIORITY[item.itemStatus] ?? 0
    const targetPriority = STATUS_PRIORITY[status] ?? 0
    if (status !== "CANCELLED" && targetPriority <= currentPriority) {
      return NextResponse.json({
        error: `Cannot move item from ${item.itemStatus} back to ${status}`,
        itemId: item.id
      }, { status: 400 })
    }
  }

  if (ownItems.some((row) => row.itemStatus === "CANCELLED" || row.itemStatus === "REFUNDED")) {
    return NextResponse.json({ error: "Cannot change cancelled or refunded item status" }, { status: 400 })
  }
  if (ownItems.some((row) => row.itemStatus === "DELIVERED")) {
    return NextResponse.json({ error: ORDER_ITEM_LOCKED_AFTER_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && (await getOrderHasDeliveredLine(prisma, orderId))) {
    return NextResponse.json({ error: ORDER_CANCEL_BLOCKED_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && ownItems.some((row) => row.itemStatus !== "PENDING")) {
    return NextResponse.json({ error: "Can only cancel items that are PENDING" }, { status: 400 })
  }
  if (status === "DELIVERED" && !deliveryProofImage) {
    return NextResponse.json({ error: "Delivery proof image is required" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({
      where: { id: { in: targetItemIds }, orderId, sellerId: seller.id, serviceId: { not: null } },
      data:
        status === "DELIVERED"
          ? {
            itemStatus: status as OrderStatus,
            deliveredAt: new Date(),
            deliveryProofImage,
          }
          : { itemStatus: status as OrderStatus },
    })
    await tx.orderItemStatusHistory.createMany({
      data: targetItemIds.map((id) => ({
        orderItemId: id,
        status: status as OrderStatus,
        location: location || null,
        note: note || null,
      })),
    })
    if (status === "DELIVERED") {
      for (const id of targetItemIds) {
        await applySellerCreditForOrderLineDelivered(tx, id)
      }
    }
    if (status === "CANCELLED") {
      await releaseServiceSlotsForOrderItems(tx, targetItemIds)
    }
  })
  return NextResponse.json({ success: true, status, updatedItemIds: targetItemIds })
}
