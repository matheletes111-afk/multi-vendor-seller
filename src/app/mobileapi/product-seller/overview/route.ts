import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { formatCurrency } from "@/lib/utils"
import { deriveOrderStatus } from "@/lib/order-status"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const [seller, globalSetting] = await Promise.all([
      prisma.seller.findUnique({
        where: { userId },
        select: { id: true, netBalance: true, commissionRate: true },
      }),
      prisma.globalSetting.findFirst(),
    ])

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })
    }

    const [subscription, totalProducts, totalOrders, totalRevenue, creditsAgg, debitsAgg, totalAdClicks] = await Promise.all([
      prisma.subscription.findFirst({
        where: { sellerId: seller.id },
        include: { plan: { select: { name: true, displayName: true } } },
      }),
      prisma.product.count({ where: { sellerId: seller.id, isActive: true, isDeleted: false } }),
      prisma.order.count({
        where: {
          items: {
            some: { sellerId: seller.id, productId: { not: null } },
          },
        },
      }),
      prisma.orderItem.aggregate({
        where: {
          sellerId: seller.id,
          productId: { not: null },
        },
        _sum: { commissionAmount: true },
      }),
      prisma.sellerBalanceTransaction.aggregate({
        where: { sellerId: seller.id, kind: "CREDIT" },
        _sum: { amount: true },
      }),
      prisma.sellerBalanceTransaction.aggregate({
        where: { sellerId: seller.id, kind: "DEBIT" },
        _sum: { amount: true },
      }),
      prisma.adClick.count({
        where: {
          ad: {
            sellerId: seller.id
          }
        }
      })
    ])

    // Fetch recent 5 orders
    const recentOrdersRaw = await prisma.order.findMany({
      where: {
        items: {
          some: { sellerId: seller.id, productId: { not: null } },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        items: {
          where: { sellerId: seller.id, productId: { not: null } },
        },
      },
    })

    const recentOrders = recentOrdersRaw.map((order) => {
      const sellerTotal = order.items.reduce(
        (sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount,
        0
      )
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: deriveOrderStatus(order.items.map((i) => i.itemStatus)),
        totalAmount: sellerTotal,
        totalAmountFormatted: formatCurrency(sellerTotal),
        customerName: order.customer?.name || "Anonymous",
        createdAt: order.createdAt,
      }
    })

    const netBalance = Number(seller.netBalance)
    const balanceCreditsTotal = Number(creditsAgg._sum.amount ?? 0)
    const balanceDebitsTotal = Number(debitsAgg._sum.amount ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          commissionRate: seller.commissionRate ?? globalSetting?.baseCommission ?? 0,
          isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue._sum.commissionAmount ?? 0,
          totalRevenueFormatted: formatCurrency(totalRevenue._sum.commissionAmount ?? 0),
          netBalance,
          netBalanceFormatted: formatCurrency(netBalance),
          balanceCreditsTotal,
          balanceCreditsFormatted: formatCurrency(balanceCreditsTotal),
          balanceDebitsTotal,
          balanceDebitsFormatted: formatCurrency(balanceDebitsTotal),
          totalAdClicks,
        },
        subscription: subscription ? { id: subscription.id, status: subscription.status, plan: subscription.plan } : null,
        recentOrders,
      },
    })
  } catch (error) {
    console.error("Mobile product seller overview error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
