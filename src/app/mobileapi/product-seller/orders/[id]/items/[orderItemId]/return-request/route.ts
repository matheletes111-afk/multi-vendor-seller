import { NextRequest, NextResponse } from "next/server"
import { getMobileSellerAuth } from "@/app/mobileapi/_helpers/seller-auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { createExchangeReplacementOrderItem } from "@/lib/exchange-replacement"
import { creditReturnRefundToWalletOnPickup } from "@/lib/return-refund-wallet"
import { applySellerCreditForExchangeTopUpCollected } from "@/lib/seller-customer-wallet-mirror"

export const dynamic = "force-dynamic"

type ReturnAction =
  | "ACCEPT"
  | "REJECT"
  | "PICKUP_COMPLETED"
  | "REFUND_COMPLETED"
  | "EXCHANGE_TOP_UP_RECEIVED"

const EPS = 0.01

/** PATCH /mobileapi/product-seller/orders/[id]/items/[orderItemId]/return-request
 * Accept, reject or update a return/exchange request. Product Seller only.
 * Auth: Bearer token.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  try {
    const authStatus = getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
    if (!authStatus.ok) {
      if (authStatus.error === "unauthorized") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: authStatus.userId },
      select: { id: true },
    })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

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
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }

    const req = await prisma.returnRequest.findFirst({
      where: {
        orderItemId,
        orderId,
        sellerId: seller.id,
      },
      select: {
        id: true,
        customerId: true,
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
    
    if (!req) return NextResponse.json({ success: false, error: "Return request not found" }, { status: 404 })

    if (action === "EXCHANGE_TOP_UP_RECEIVED") {
      if (req.resolutionType !== "EXCHANGE" || req.status !== "ACCEPTED") {
        return NextResponse.json({ success: false, error: "Top-up applies only to accepted exchange requests" }, { status: 400 })
      }
      if ((req.exchangeTopUpAmount ?? 0) <= EPS) {
        return NextResponse.json({ success: false, error: "No price top-up is due for this exchange" }, { status: 400 })
      }
      if (req.exchangeTopUpStatus !== "PENDING") {
        return NextResponse.json({ success: false, error: "Top-up is not pending" }, { status: 400 })
      }
      const topUp = req.exchangeTopUpAmount ?? 0
      const updated = await prisma.$transaction(async (tx) => {
        await applySellerCreditForExchangeTopUpCollected(tx, {
          sellerId: seller.id,
          returnRequestId: req.id,
          orderId,
          amount: topUp,
          note: "Exchange upgrade: price difference collected from customer (recorded as received)",
        })
        return tx.returnRequest.update({
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
      })
      return NextResponse.json({ success: true, message: "Exchange top-up recorded", data: updated })
    }

    if (action === "ACCEPT") {
      if (req.status !== "REQUESTED") {
        return NextResponse.json({ success: false, error: "Only requested returns can be accepted" }, { status: 400 })
      }
      if (req.resolutionType === "EXCHANGE") {
        if (!req.replacementVariantId) {
          return NextResponse.json({ success: false, error: "Exchange request is missing replacement variant" }, { status: 400 })
        }
        try {
          const updated = await prisma.$transaction(async (tx) => {
            const created = await createExchangeReplacementOrderItem(tx, {
              originalOrderItemId: orderItemId,
              replacementVariantId: req.replacementVariantId!,
              sellerId: seller.id,
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
          return NextResponse.json({ success: true, message: "Exchange accepted", data: updated })
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to create exchange replacement"
          return NextResponse.json({ success: false, error: msg }, { status: 400 })
        }
      }

      const updated = await prisma.returnRequest.update({
        where: { id: req.id },
        data: { status: "ACCEPTED", pickupStatus: "PENDING", refundStatus: "PENDING" },
        select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
      })
      return NextResponse.json({ success: true, message: "Return accepted", data: updated })
    }

    if (action === "REJECT") {
      if (req.status !== "REQUESTED") {
        return NextResponse.json({ success: false, error: "Only requested returns can be rejected" }, { status: 400 })
      }
      const updated = await prisma.returnRequest.update({
        where: { id: req.id },
        data: { status: "REJECTED" },
        select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
      })
      return NextResponse.json({ success: true, message: "Return rejected", data: updated })
    }

    if (req.resolutionType === "EXCHANGE") {
      if (action === "PICKUP_COMPLETED") {
        return NextResponse.json(
          { success: false, error: "Pickup for exchange is completed automatically when the replacement is delivered" },
          { status: 400 }
        )
      }
      if (action === "REFUND_COMPLETED") {
        return NextResponse.json({ success: false, error: "Refund does not apply to this exchange request" }, { status: 400 })
      }
    }

    if (action === "PICKUP_COMPLETED") {
      if (req.status !== "ACCEPTED") {
        return NextResponse.json({ success: false, error: "Pickup can be completed only for accepted returns" }, { status: 400 })
      }
      if (req.pickupStatus === "COMPLETED") {
        const updated = await prisma.returnRequest.findUnique({
          where: { id: req.id },
          select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
        })
        return NextResponse.json({ success: true, message: "Pickup already completed", data: updated })
      }

      if (req.resolutionType === "REFUND") {
        const updated = await prisma.$transaction(async (tx) => {
          await creditReturnRefundToWalletOnPickup(tx, {
            returnRequestId: req.id,
            customerId: req.customerId,
            orderItemId,
            sellerId: seller.id,
            orderId,
          })
          return tx.returnRequest.update({
            where: { id: req.id },
            data: { pickupStatus: "COMPLETED", refundStatus: "COMPLETED" },
            select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
          })
        })
        return NextResponse.json({ success: true, message: "Pickup completed and refunded", data: updated })
      }

      const updated = await prisma.returnRequest.update({
        where: { id: req.id },
        data: { pickupStatus: "COMPLETED" },
        select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
      })
      return NextResponse.json({ success: true, message: "Pickup completed", data: updated })
    }

    if (action !== "REFUND_COMPLETED") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }

    if (req.status !== "ACCEPTED") {
      return NextResponse.json({ success: false, error: "Refund can be completed only for accepted returns" }, { status: 400 })
    }
    if (req.pickupStatus !== "COMPLETED") {
      return NextResponse.json({ success: false, error: "Complete pickup before finalizing return" }, { status: 400 })
    }
    if (req.resolutionType === "REFUND" && req.refundStatus !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Wallet credit is applied when pickup is completed; complete pickup first" },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: { itemStatus: true, productVariantId: true, quantity: true },
      })
      if (!current) {
        throw new Error("Order item not found")
      }
      if (current.itemStatus !== "REFUNDED") {
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: { itemStatus: "REFUNDED" },
        })
        await tx.orderItemStatusHistory.create({
          data: {
            orderItemId,
            status: "REFUNDED",
            note: "Return finalized: item refunded and restocked",
          },
        })
        if (current.productVariantId) {
          await tx.productVariant.update({
            where: { id: current.productVariantId },
            data: { stock: { increment: current.quantity } },
          })
        }
      }
      return tx.returnRequest.findUnique({
        where: { id: req.id },
        select: { id: true, status: true, pickupStatus: true, refundStatus: true, resolutionType: true },
      })
    })

    return NextResponse.json({ success: true, message: "Refund finalized", data: updated })
  } catch (error) {
    console.error("Mobile product seller return request error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
