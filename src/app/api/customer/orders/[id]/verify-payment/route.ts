import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { queryAfriMoneyTransaction } from "@/lib/afrimoney"
import { verifyFlotPaymentAttempt } from "@/lib/flot"

export const dynamic = "force-dynamic"

async function resolveCustomerUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) return session.user.id

  const mobileAuth = await getMobileCustomerAuth(request)
  if (mobileAuth.ok) return mobileAuth.userId

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const customerId = await resolveCustomerUserId(request)
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: {
      id,
      customerId,
    },
    include: {
      items: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // If already completed or failed, return status directly
  if (order.paymentStatus === "COMPLETED" || order.paymentStatus === "FAILED") {
    if (order.paymentStatus === "COMPLETED") {
      await prisma.cartItem.deleteMany({
        where: { userId: order.customerId },
      }).catch(() => null)
    }
    return NextResponse.json({
      success: order.paymentStatus === "COMPLETED",
      paymentStatus: order.paymentStatus,
      status: order.status,
      paidAt: order.paidAt,
      afriTxnId: order.afriTxnId,
      flotOrderId: order.flotOrderId,
      paymentMethod: order.paymentMethod,
    })
  }

  // Active query to AfriMoney gateway if external reference exists
  if (order.afriFtxnId) {
    try {
      const enqRes = await queryAfriMoneyTransaction(order.afriFtxnId).catch(() => null)
      const txnStatus = enqRes?.COMMAND?.TXNSTATUS || enqRes?.txn_status || ""
      const isSuccess = txnStatus.toUpperCase() === "TS" || txnStatus.toUpperCase() === "SUCCESS"
      const isFailed = txnStatus.toUpperCase() === "TF" || txnStatus.toUpperCase().includes("FAIL")

      if (isSuccess) {
        const txnId = enqRes?.COMMAND?.TXNID || enqRes?.transaction_id || null
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "COMPLETED",
            status: order.status === "PENDING" ? "CONFIRMED" : order.status,
            afriTxnId: txnId || order.afriTxnId,
            paidAt: new Date(),
          },
        })

        await prisma.orderItem.updateMany({
          where: { orderId: order.id, itemStatus: "PENDING" },
          data: { itemStatus: "CONFIRMED", settlementStatus: "ESCROW_HELD" },
        })
        await prisma.orderItem.updateMany({
          where: { orderId: order.id, settlementStatus: "PENDING" },
          data: { settlementStatus: "ESCROW_HELD" },
        })

        // Record CONFIRMED status history for all items
        const orderLineItems = await prisma.orderItem.findMany({
          where: { orderId: order.id },
          select: { id: true },
        })
        if (orderLineItems.length > 0) {
          await prisma.orderItemStatusHistory.createMany({
            data: orderLineItems.map((item) => ({
              orderItemId: item.id,
              status: "CONFIRMED",
              note: `AfriMoney payment verified: ${txnId || "SUCCESS"}`,
              location: "Verify Payment Poll",
            })),
          }).catch(() => null)
        }

        // Clear cart for the customer upon verified payment
        await prisma.cartItem.deleteMany({
          where: { userId: order.customerId },
        }).catch(() => null)

        // Upsert Payment record for AfriMoney
        const existingAfriPayment = await prisma.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: "desc" },
        })

        if (existingAfriPayment) {
          await prisma.payment.update({
            where: { id: existingAfriPayment.id },
            data: {
              status: "COMPLETED",
              method: "AFRIMONEY",
              gatewayReferenceId: txnId || order.afriTxnId || existingAfriPayment.gatewayReferenceId,
            },
          })
        } else {
          await prisma.payment.create({
            data: {
              orderId: order.id,
              amount: order.totalAmount,
              status: "COMPLETED",
              method: "AFRIMONEY",
              gatewayReferenceId: txnId || order.afriTxnId || null,
            },
          })
        }

        return NextResponse.json({
          success: true,
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paidAt: new Date(),
          afriTxnId: txnId || order.afriTxnId,
        })
      } else if (isFailed) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
          },
        })

        await prisma.orderItem.updateMany({
          where: { orderId: order.id, itemStatus: "PENDING" },
          data: { itemStatus: "CANCELLED", settlementStatus: "CANCELLED" },
        })

        // Restore inventory & coupon
        for (const item of order.items) {
          if (item.productVariantId) {
            await prisma.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => null)
          }
          if (item.serviceSlotId) {
            await prisma.serviceSlot.update({
              where: { id: item.serviceSlotId },
              data: { isBooked: false },
            }).catch(() => null)
          }
        }
        await prisma.couponUsage.deleteMany({
          where: { orderId: order.id },
        }).catch(() => null)

        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          status: "CANCELLED",
        })
      }
    } catch (queryErr) {
      console.warn("[Verify Payment] AfriMoney transaction query error:", queryErr)
    }
  }

  // Active query to Float gateway if Float identifiers exist
  if (order.flotOrderId && order.flotInternalOrderId) {
    try {
      const attempt = await verifyFlotPaymentAttempt({
        externalOrderId: order.flotOrderId,
        internalOrderId: order.flotInternalOrderId,
      })

      if (attempt?.status === "completed") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "COMPLETED",
            paymentMethod: "FLOAT",
            status: order.status === "PENDING" ? "CONFIRMED" : order.status,
            paidAt: new Date(),
          },
        })

        await prisma.orderItem.updateMany({
          where: { orderId: order.id, itemStatus: "PENDING" },
          data: { itemStatus: "CONFIRMED", settlementStatus: "ESCROW_HELD" },
        })
        await prisma.orderItem.updateMany({
          where: { orderId: order.id, settlementStatus: "PENDING" },
          data: { settlementStatus: "ESCROW_HELD" },
        })

        const orderLineItems = await prisma.orderItem.findMany({
          where: { orderId: order.id },
          select: { id: true },
        })
        if (orderLineItems.length > 0) {
          await prisma.orderItemStatusHistory.createMany({
            data: orderLineItems.map((item) => ({
              orderItemId: item.id,
              status: "CONFIRMED",
              note: `Float card payment verified: ${order.flotOrderId}`,
              location: "Verify Payment Poll",
            })),
          }).catch(() => null)
        }

        // Clear cart for the customer upon verified payment
        await prisma.cartItem.deleteMany({
          where: { userId: order.customerId },
        }).catch(() => null)

        // Upsert Payment record for Float
        const existingFlotPayment = await prisma.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: "desc" },
        })

        if (existingFlotPayment) {
          await prisma.payment.update({
            where: { id: existingFlotPayment.id },
            data: {
              status: "COMPLETED",
              method: "FLOAT",
              gatewayReferenceId: order.flotOrderId || existingFlotPayment.gatewayReferenceId,
            },
          })
        } else {
          await prisma.payment.create({
            data: {
              orderId: order.id,
              amount: order.totalAmount,
              status: "COMPLETED",
              method: "FLOAT",
              gatewayReferenceId: order.flotOrderId || null,
            },
          })
        }

        return NextResponse.json({
          success: true,
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paidAt: new Date(),
          paymentMethod: "FLOAT",
          flotOrderId: order.flotOrderId,
        })
      } else if (attempt?.status === "failed") {
        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          status: order.status,
          message: "Float card payment attempt was unsuccessful. You may retry or choose another payment method.",
        })
      }
    } catch (flotQueryErr) {
      console.warn("[Verify Payment] Float attempt query error:", flotQueryErr)
    }
  }

  return NextResponse.json({
    success: false,
    paymentStatus: order.paymentStatus,
    status: order.status,
  })
}

