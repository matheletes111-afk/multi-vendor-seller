import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

function sourceLabel(reason: string): string {
  if (reason === "RETURN_REFUND") return "Return refund (after seller confirms pickup)"
  if (reason === "EXCHANGE_PRICE_DIFFERENCE") return "Exchange — cheaper replacement (credited when replacement is delivered)"
  return reason.replace(/_/g, " ")
}

/** GET /api/customer/wallet/transactions/[id] — one wallet credit with linked return / order context. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const tx = await prisma.walletTransaction.findFirst({
    where: { id, userId: session.user.id },
    include: {
      returnRequest: {
        include: {
          orderItem: {
            select: {
              id: true,
              productNameSnapshot: true,
              serviceNameSnapshot: true,
              orderId: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
          replacementOrderItem: {
            select: {
              id: true,
              productNameSnapshot: true,
              serviceNameSnapshot: true,
              itemStatus: true,
              orderId: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
        },
      },
    },
  })

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  const rr = tx.returnRequest
  const orderFromItem = rr?.orderItem?.order ?? null

  const body = {
    id: tx.id,
    amount: Number(tx.amount),
    kind: "CREDIT" as const,
    reason: tx.reason,
    sourceLabel: sourceLabel(tx.reason),
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
    order:
      orderFromItem != null
        ? { id: orderFromItem.id, orderNumber: orderFromItem.orderNumber }
        : null,
    returnRequest: rr
      ? {
          id: rr.id,
          resolutionType: rr.resolutionType,
          status: rr.status,
          pickupStatus: rr.pickupStatus,
          refundStatus: rr.refundStatus,
          customerReason: rr.reason,
          exchangeRefundDifferenceAmount: rr.exchangeRefundDifferenceAmount,
          exchangeRefundDifferenceStatus: rr.exchangeRefundDifferenceStatus,
          originalLine: {
            id: rr.orderItem.id,
            productNameSnapshot: rr.orderItem.productNameSnapshot,
            serviceNameSnapshot: rr.orderItem.serviceNameSnapshot,
          },
          replacementLine: rr.replacementOrderItem
            ? {
                id: rr.replacementOrderItem.id,
                itemStatus: rr.replacementOrderItem.itemStatus,
                productNameSnapshot: rr.replacementOrderItem.productNameSnapshot,
                serviceNameSnapshot: rr.replacementOrderItem.serviceNameSnapshot,
                order: {
                  id: rr.replacementOrderItem.order.id,
                  orderNumber: rr.replacementOrderItem.order.orderNumber,
                },
              }
            : null,
        }
      : null,
  }

  return NextResponse.json(body)
}
