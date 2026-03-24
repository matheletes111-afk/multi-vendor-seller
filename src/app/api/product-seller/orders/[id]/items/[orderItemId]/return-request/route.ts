import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

type ReturnAction = "ACCEPT" | "REJECT" | "PICKUP_COMPLETED" | "REFUND_COMPLETED"

/** PATCH /api/product-seller/orders/[id]/items/[orderItemId]/return-request */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  // Work around stale Prisma client types in editor diagnostics.
  const db = prisma as any
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId, orderItemId } = await params
  const body = (await request.json().catch(() => ({}))) as { action?: ReturnAction }
  const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : ""
  const allowed: ReturnAction[] = ["ACCEPT", "REJECT", "PICKUP_COMPLETED", "REFUND_COMPLETED"]
  if (!allowed.includes(action as ReturnAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const req = await db.returnRequest.findFirst({
    where: {
      orderItemId,
      orderId,
      sellerId: seller.id,
    },
    select: {
      id: true,
      status: true,
      pickupStatus: true,
      refundStatus: true,
    },
  })
  if (!req) return NextResponse.json({ error: "Return request not found" }, { status: 404 })

  if (action === "ACCEPT") {
    if (req.status !== "REQUESTED") {
      return NextResponse.json({ error: "Only requested returns can be accepted" }, { status: 400 })
    }
    const updated = await db.returnRequest.update({
      where: { id: req.id },
      data: { status: "ACCEPTED", pickupStatus: "PENDING", refundStatus: "PENDING" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (action === "REJECT") {
    if (req.status !== "REQUESTED") {
      return NextResponse.json({ error: "Only requested returns can be rejected" }, { status: 400 })
    }
    const updated = await db.returnRequest.update({
      where: { id: req.id },
      data: { status: "REJECTED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (action === "PICKUP_COMPLETED") {
    if (req.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Pickup can be completed only for accepted returns" }, { status: 400 })
    }
    const updated = await db.returnRequest.update({
      where: { id: req.id },
      data: { pickupStatus: "COMPLETED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (req.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Refund can be completed only for accepted returns" }, { status: 400 })
  }
  if (req.pickupStatus !== "COMPLETED") {
    return NextResponse.json({ error: "Complete pickup before refund" }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const txAny = tx as any
    const rr = await txAny.returnRequest.update({
      where: { id: req.id },
      data: { refundStatus: "COMPLETED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true },
    })
    const item = await txAny.orderItem.update({
      where: { id: orderItemId },
      data: { itemStatus: "REFUNDED" },
      select: { productId: true, productVariantId: true, quantity: true },
    })
    await txAny.orderItemStatusHistory.create({
      data: {
        orderItemId,
        status: "REFUNDED",
        note: "Refund completed",
      },
    })
    if (item.productVariantId) {
      await txAny.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      })
    }
    return rr
  })

  return NextResponse.json({ success: true, returnRequest: updated })
}

