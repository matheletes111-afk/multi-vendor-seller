import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { createExchangeReplacementOrderItem } from "@/lib/exchange-replacement"

type ReturnAction =
  | "ACCEPT"
  | "REJECT"
  | "PICKUP_COMPLETED"
  | "REFUND_COMPLETED"
  | "EXCHANGE_TOP_UP_RECEIVED"

const EPS = 0.01

/** PATCH /api/admin/orders/[id]/items/[orderItemId]/return-request — same actions as product-seller; admin only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orderId, orderItemId } = await params
  const body = (await request.json().catch(() => ({}))) as { action?: ReturnAction }
  const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : ""
  const allowed: ReturnAction[] = [
    "ACCEPT",
    "REJECT",
    "PICKUP_COMPLETED",
    "REFUND_COMPLETED",
    "EXCHANGE_TOP_UP_RECEIVED",
  ]
  if (!allowed.includes(action as ReturnAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const req = await prisma.returnRequest.findFirst({
    where: {
      orderItemId,
      orderId,
    },
    select: {
      id: true,
      sellerId: true,
      status: true,
      pickupStatus: true,
      refundStatus: true,
      resolutionType: true,
      replacementVariantId: true,
      exchangeTopUpAmount: true,
      exchangeTopUpStatus: true,
      exchangeRefundDifferenceAmount: true,
      exchangeRefundDifferenceStatus: true,
    },
  })
  if (!req) return NextResponse.json({ error: "Return request not found" }, { status: 404 })

  if (action === "EXCHANGE_TOP_UP_RECEIVED") {
    if (req.resolutionType !== "EXCHANGE" || req.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Top-up applies only to accepted exchange requests" }, { status: 400 })
    }
    if ((req.exchangeTopUpAmount ?? 0) <= EPS) {
      return NextResponse.json({ error: "No price top-up is due for this exchange" }, { status: 400 })
    }
    if (req.exchangeTopUpStatus !== "PENDING") {
      return NextResponse.json({ error: "Top-up is not pending" }, { status: 400 })
    }
    const updated = await prisma.returnRequest.update({
      where: { id: req.id },
      data: { exchangeTopUpStatus: "COMPLETED" },
      select: {
        id: true,
        status: true,
        pickupStatus: true,
        refundStatus: true,
        resolutionType: true,
        exchangeTopUpAmount: true,
        exchangeTopUpStatus: true,
        exchangeRefundDifferenceAmount: true,
        exchangeRefundDifferenceStatus: true,
      },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (action === "ACCEPT") {
    if (req.status !== "REQUESTED") {
      return NextResponse.json({ error: "Only requested returns can be accepted" }, { status: 400 })
    }
    if (req.resolutionType === "EXCHANGE") {
      if (!req.replacementVariantId) {
        return NextResponse.json({ error: "Exchange request is missing replacement variant" }, { status: 400 })
      }
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const created = await createExchangeReplacementOrderItem(tx, {
            originalOrderItemId: orderItemId,
            replacementVariantId: req.replacementVariantId!,
            sellerId: req.sellerId,
          })
          return tx.returnRequest.update({
            where: { id: req.id },
            data: {
              status: "ACCEPTED",
              pickupStatus: "PENDING",
              refundStatus: "NOT_REQUESTED",
              replacementOrderItemId: created.id,
              exchangeTopUpAmount: created.exchangeTopUpAmount,
              exchangeTopUpStatus: created.exchangeTopUpStatus,
              exchangeRefundDifferenceAmount: created.exchangeRefundDifferenceAmount,
              exchangeRefundDifferenceStatus: created.exchangeRefundDifferenceStatus,
            },
            select: {
              id: true,
              status: true,
              pickupStatus: true,
              refundStatus: true,
              resolutionType: true,
              replacementOrderItemId: true,
              exchangeTopUpAmount: true,
              exchangeTopUpStatus: true,
              exchangeRefundDifferenceAmount: true,
              exchangeRefundDifferenceStatus: true,
            },
          })
        })
        return NextResponse.json({ success: true, returnRequest: updated })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create exchange replacement"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    const updated = await prisma.returnRequest.update({
      where: { id: req.id },
      data: { status: "ACCEPTED", pickupStatus: "PENDING", refundStatus: "PENDING" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (action === "REJECT") {
    if (req.status !== "REQUESTED") {
      return NextResponse.json({ error: "Only requested returns can be rejected" }, { status: 400 })
    }
    const updated = await prisma.returnRequest.update({
      where: { id: req.id },
      data: { status: "REJECTED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
    })
    return NextResponse.json({ success: true, returnRequest: updated })
  }

  if (req.resolutionType === "EXCHANGE") {
    if (action === "PICKUP_COMPLETED") {
      return NextResponse.json(
        { error: "Pickup for exchange is completed automatically when the replacement is delivered" },
        { status: 400 }
      )
    }
    if (action === "REFUND_COMPLETED") {
      return NextResponse.json({ error: "Refund does not apply to this exchange request" }, { status: 400 })
    }
  }

  if (action === "PICKUP_COMPLETED") {
    if (req.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Pickup can be completed only for accepted returns" }, { status: 400 })
    }
    const updated = await prisma.returnRequest.update({
      where: { id: req.id },
      data: { pickupStatus: "COMPLETED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
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
    const rr = await tx.returnRequest.update({
      where: { id: req.id },
      data: { refundStatus: "COMPLETED" },
      select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
    })
    const item = await tx.orderItem.update({
      where: { id: orderItemId },
      data: { itemStatus: "REFUNDED" },
      select: { productId: true, productVariantId: true, quantity: true },
    })
    await tx.orderItemStatusHistory.create({
      data: {
        orderItemId,
        status: "REFUNDED",
        note: "Refund completed",
      },
    })
    if (item.productVariantId) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      })
    }
    return rr
  })

  return NextResponse.json({ success: true, returnRequest: updated })
}
