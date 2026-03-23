import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import type {
  AdminOrderDetailApi,
  AdminOrderDetailItemApi,
  PatchOrderStatusPayload,
} from "../types"
import { ADMIN_ORDER_STATUSES } from "../types"
import { deriveOrderStatus, summarizeSellerItemStatuses } from "@/lib/order-status"

function isValidAdminStatus(s: string): s is PatchOrderStatusPayload["status"] {
  return ADMIN_ORDER_STATUSES.includes(s as PatchOrderStatusPayload["status"])
}

/** GET /api/admin/orders/[id] — get one order. ADMIN only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id: orderId } = await params

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true, email: true } },
      seller: { include: { store: { select: { name: true } } } },
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

  const items: AdminOrderDetailItemApi[] = order.items.map((row) => {
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

  const body: AdminOrderDetailApi = {
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
    sellerStoreName: order.seller?.store?.name ?? null,
    sellerGroups,
    items,
  }
  return NextResponse.json(body)
}

/** PATCH /api/admin/orders/[id] — update order status. ADMIN only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id: orderId } = await params
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as PatchOrderStatusPayload
  const status = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : null
  const itemId = typeof (body as { itemId?: string }).itemId === "string" ? (body as { itemId?: string }).itemId : null
  const itemIds = Array.isArray((body as { itemIds?: string[] }).itemIds)
    ? (body as { itemIds?: string[] }).itemIds!.filter((v): v is string => typeof v === "string")
    : []
  if (!status || !isValidAdminStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + ADMIN_ORDER_STATUSES.join(", ") },
      { status: 400 }
    )
  }

  const targetItemIds = [...new Set([...(itemId ? [itemId] : []), ...itemIds])]
  if (targetItemIds.length === 0) {
    await prisma.orderItem.updateMany({
      where: { orderId },
      data: { itemStatus: status },
    })
    return NextResponse.json({ success: true, status, updatedAllItems: true })
  }
  const count = await prisma.orderItem.count({
    where: { orderId, id: { in: targetItemIds } },
  })
  if (count !== targetItemIds.length) {
    return NextResponse.json({ error: "One or more items are not in this order" }, { status: 404 })
  }
  await prisma.orderItem.updateMany({
    where: { orderId, id: { in: targetItemIds } },
    data: { itemStatus: status },
  })
  return NextResponse.json({ success: true, status, updatedItemIds: targetItemIds })
}
