import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { queryAfriMoneyTransaction } from "@/lib/afrimoney"
import { verifyFlotPaymentAttempt } from "@/lib/flot"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileCustomerAuth(request)
  if (!authStatus.ok || !authStatus.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const foodOrder = await prisma.foodOrder.findFirst({
    where: {
      id,
      customerId: authStatus.userId,
    },
    include: {
      items: true,
    },
  })

  if (!foodOrder) {
    return NextResponse.json({ error: "Food order not found" }, { status: 404 })
  }

  if (foodOrder.paymentStatus === "COMPLETED" || foodOrder.paymentStatus === "FAILED") {
    return NextResponse.json({
      success: foodOrder.paymentStatus === "COMPLETED",
      paymentStatus: foodOrder.paymentStatus,
      status: foodOrder.status,
      paidAt: foodOrder.paidAt,
      afriTxnId: foodOrder.afriTxnId,
      flotOrderId: foodOrder.flotOrderId,
      paymentMethod: foodOrder.paymentMethod,
    })
  }

  // Fallback query to AfriMoney if external reference exists
  if (foodOrder.afriFtxnId) {
    try {
      const enqRes = await queryAfriMoneyTransaction(foodOrder.afriFtxnId).catch(() => null)
      const txnStatus = enqRes?.COMMAND?.TXNSTATUS || enqRes?.txn_status || ""
      const isSuccess = txnStatus.toUpperCase() === "TS" || txnStatus.toUpperCase() === "SUCCESS"
      const isFailed = txnStatus.toUpperCase() === "TF" || txnStatus.toUpperCase().includes("FAIL")

      if (isSuccess) {
        const txnId = enqRes?.COMMAND?.TXNID || enqRes?.transaction_id || null
        await prisma.foodOrder.update({
          where: { id: foodOrder.id },
          data: {
            paymentStatus: "COMPLETED",
            status: "CONFIRMED",
            settlementStatus: "ESCROW_HELD",
            afriTxnId: txnId || foodOrder.afriTxnId,
            paidAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paidAt: new Date(),
          afriTxnId: txnId || foodOrder.afriTxnId,
        })
      } else if (isFailed) {
        await prisma.foodOrder.update({
          where: { id: foodOrder.id },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            settlementStatus: "CANCELLED",
          },
        })

        await prisma.couponUsage.deleteMany({
          where: { foodOrderId: foodOrder.id },
        }).catch(() => null)

        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          status: "CANCELLED",
        })
      }
    } catch (queryErr) {
      console.warn("[Mobile Verify Payment] AfriMoney transaction query error:", queryErr)
    }
  }

  // Active query to Float gateway if Float identifiers exist
  if (foodOrder.flotOrderId && foodOrder.flotInternalOrderId) {
    try {
      const attempt = await verifyFlotPaymentAttempt({
        externalOrderId: foodOrder.flotOrderId,
        internalOrderId: foodOrder.flotInternalOrderId,
      })

      if (attempt?.status === "completed") {
        await prisma.foodOrder.update({
          where: { id: foodOrder.id },
          data: {
            paymentStatus: "COMPLETED",
            paymentMethod: "FLOAT",
            status: "CONFIRMED",
            settlementStatus: "ESCROW_HELD",
            paidAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          paymentStatus: "COMPLETED",
          status: "CONFIRMED",
          paidAt: new Date(),
          paymentMethod: "FLOAT",
          flotOrderId: foodOrder.flotOrderId,
        })
      } else if (attempt?.status === "failed") {
        return NextResponse.json({
          success: false,
          paymentStatus: "FAILED",
          status: foodOrder.status,
          message: "Float card payment attempt was unsuccessful. You may retry or choose another payment method.",
        })
      }
    } catch (flotQueryErr) {
      console.warn("[Mobile Food Verify Payment] Float attempt query error:", flotQueryErr)
    }
  }

  return NextResponse.json({
    success: false,
    paymentStatus: foodOrder.paymentStatus,
    status: foodOrder.status,
  })
}
