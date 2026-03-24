import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

/** POST /api/customer/orders/[id]/items/[orderItemId]/return-request */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId, orderItemId } = await params
  const body = (await request.json().catch(() => ({}))) as { reason?: string }
  const reason = typeof body.reason === "string" ? body.reason.trim() : null

  const item = await prisma.orderItem.findFirst({
    where: {
      id: orderItemId,
      orderId,
      order: { customerId: session.user.id },
      productId: { not: null },
    },
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      itemStatus: true,
      deliveredAt: true,
      quantity: true,
      returnRequest: { select: { id: true } },
      productVariant: { select: { returnType: true, returnDays: true } },
    },
  })

  if (!item) return NextResponse.json({ error: "Order item not found" }, { status: 404 })
  if (!item.sellerId) return NextResponse.json({ error: "Seller not found for this item" }, { status: 400 })
  if (item.itemStatus !== "DELIVERED") {
    return NextResponse.json({ error: "Return is allowed only for delivered items" }, { status: 400 })
  }
  if (item.productVariant?.returnType !== "RETURNABLE") {
    return NextResponse.json({ error: "This item is not returnable" }, { status: 400 })
  }
  const returnDays = item.productVariant.returnDays ?? 0
  if (returnDays <= 0) {
    return NextResponse.json({ error: "Return period is not configured for this item" }, { status: 400 })
  }
  const deliveredAt = item.deliveredAt ?? null
  if (!deliveredAt) {
    return NextResponse.json({ error: "Return is allowed only after delivered confirmation" }, { status: 400 })
  }
  const now = Date.now()
  const deadline = deliveredAt.getTime() + returnDays * 24 * 60 * 60 * 1000
  if (now > deadline) {
    return NextResponse.json({ error: "Return period has expired for this item" }, { status: 400 })
  }
  if (item.returnRequest?.id) {
    return NextResponse.json({ error: "Return already requested for this item" }, { status: 409 })
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderItemId: item.id,
      orderId: item.orderId,
      customerId: session.user.id,
      sellerId: item.sellerId,
      reason: reason || null,
      status: "REQUESTED",
      pickupStatus: "NOT_REQUESTED",
      refundStatus: "NOT_REQUESTED",
    },
    select: {
      id: true,
      status: true,
      pickupStatus: true,
      refundStatus: true,
    },
  })

  return NextResponse.json({ success: true, returnRequest: created })
}

