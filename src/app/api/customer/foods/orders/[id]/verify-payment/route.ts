import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import { queryAfriMoneyTransaction } from "@/lib/afrimoney"

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
  const foodOrder = await prisma.foodOrder.findFirst({
    where: {
      id,
      customerId,
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
      console.warn("[Verify Payment] AfriMoney transaction query error:", queryErr)
    }
  }

  return NextResponse.json({
    success: false,
    paymentStatus: foodOrder.paymentStatus,
    status: foodOrder.status,
  })
}

