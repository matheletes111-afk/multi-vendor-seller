import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { getMobileSellerAuth } from "@/app/mobileapi/_helpers/seller-auth"
import { UserRole } from "@prisma/client"
import { serviceSellerLineGross } from "@/lib/service-seller-order-money"

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user && isServiceSeller(session.user)) return session.user.id
  const mobileAuth = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (mobileAuth.ok && mobileAuth.userId) return mobileAuth.userId
  return null
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      select: { id: true, netBalance: true },
    })
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

    const serviceLines = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        serviceId: { not: null },
      },
      select: {
        id: true,
        orderId: true,
        createdAt: true,
        subtotalInclGst: true,
        subtotal: true,
        gstAmount: true,
        shippingAmount: true,
        commissionAmount: true,
        commissionRateSnapshot: true,
        serviceNameSnapshot: true,
        itemStatus: true,
        settlementStatus: true,
        payoutReference: true,
        payoutDisbursedAt: true,
        order: {
          select: {
            orderNumber: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    let totalCredits = 0
    let totalDebits = 0

    const lines = serviceLines.map((line) => {
      const gross = serviceSellerLineGross(line as any)
      const commission = line.commissionAmount ?? 0
      const net = Math.max(0, gross - commission)

      if (line.itemStatus === "DELIVERED") {
        totalCredits += net
      } else if (line.itemStatus === "CANCELLED" || line.itemStatus === "REFUNDED") {
        totalDebits += net
      }

      return {
        id: line.id,
        orderId: line.orderId,
        orderNumber: line.order?.orderNumber || "Unknown",
        serviceName: line.serviceNameSnapshot || "Service",
        gross,
        commission,
        commissionRate: line.commissionRateSnapshot ?? 10.0,
        net,
        itemStatus: line.itemStatus,
        settlementStatus: line.settlementStatus || (line.itemStatus === "DELIVERED" ? "YET_TO_PAY" : "ESCROW_HELD"),
        payoutReference: line.payoutReference,
        payoutDisbursedAt: line.payoutDisbursedAt,
        createdAt: line.createdAt.toISOString(),
      }
    })

    const debitsAgg = await prisma.sellerBalanceTransaction.aggregate({
      where: { sellerId: seller.id, kind: "DEBIT" },
      _sum: { amount: true },
    })
    const actualDebits = Number(debitsAgg._sum.amount ?? 0)

    return NextResponse.json({
      success: true,
      netBalance: Number(seller.netBalance),
      balanceCreditsTotal: totalCredits,
      balanceDebitsTotal: actualDebits > 0 ? actualDebits : totalDebits,
      serviceLines: lines,
    })
  } catch (err: any) {
    console.error("Service seller net worth error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

