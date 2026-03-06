import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { OrderDetailApi, OrderDetailItemApi } from "../types"

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
          product: { select: { images: true } },
          productVariant: { select: { images: true } },
          service: { select: { images: true } },
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

  const items: OrderDetailItemApi[] = order.items.map((row) => {
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

  const body: OrderDetailApi = {
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

  return NextResponse.json(body)
}
