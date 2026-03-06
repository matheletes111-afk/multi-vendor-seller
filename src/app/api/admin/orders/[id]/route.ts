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
          product: { select: { images: true } },
          productVariant: { select: { images: true } },
          service: { select: { images: true } },
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
    }
  })

  const body: AdminOrderDetailApi = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    commission: order.commission,
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
  if (!status || !isValidAdminStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + ADMIN_ORDER_STATUSES.join(", ") },
      { status: 400 }
    )
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })
  return NextResponse.json({ success: true, status })
}
