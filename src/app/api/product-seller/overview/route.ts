import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"
import { getValidSubscription } from "@/lib/subscriptions"

/** GET dashboard overview. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [seller, globalSetting] = await Promise.all([
    prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true, netBalance: true, commissionRate: true },
    }),
    prisma.globalSetting.findFirst(),
  ])

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const [subscription, totalProducts, totalOrders, revenueAgg, pendingRevenueAgg, riderShippingAgg, selfShippingAgg, creditsAgg, debitsAgg, totalAdClicks] = await Promise.all([
    getValidSubscription(seller.id),
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
        itemStatus: "DELIVERED",
      },
      _sum: {
        subtotalInclGst: true,
        shippingAmount: true,
        commissionAmount: true,
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        sellerId: seller.id,
        productId: { not: null },
        itemStatus: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
      },
      _sum: {
        subtotalInclGst: true,
        shippingAmount: true,
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        sellerId: seller.id,
        productId: { not: null },
        itemStatus: "DELIVERED",
        isSelfDelivery: false,
      },
      _sum: {
        shippingAmount: true,
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        sellerId: seller.id,
        productId: { not: null },
        itemStatus: "DELIVERED",
        isSelfDelivery: true,
      },
      _sum: {
        shippingAmount: true,
      },
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

  const grossSales = revenueAgg._sum.subtotalInclGst ?? 0
  const deliveryBoyCharges = riderShippingAgg._sum.shippingAmount ?? 0
  const selfDeliveryShipping = selfShippingAgg._sum.shippingAmount ?? 0
  const pendingSales = pendingRevenueAgg._sum.subtotalInclGst ?? 0
  const platformCommission = revenueAgg._sum.commissionAmount ?? 0
  const netEarnings = Math.max(0, grossSales - platformCommission - deliveryBoyCharges + selfDeliveryShipping)
  const netBalance = Number(seller.netBalance)
  const balanceCreditsTotal = Number(creditsAgg._sum.amount ?? 0)
  const balanceDebitsTotal = Number(debitsAgg._sum.amount ?? 0)

  return NextResponse.json({
    subscription: subscription ? { ...subscription, plan: subscription.plan } : null,
    commissionRate: seller.commissionRate ?? globalSetting?.productBaseCommission ?? globalSetting?.baseCommission ?? 10.0,
    isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
    totalProducts,
    totalOrders,
    totalRevenue: grossSales,
    totalRevenueFormatted: formatCurrency(grossSales),
    pendingRevenue: pendingSales,
    pendingRevenueFormatted: formatCurrency(pendingSales),
    grossSales,
    grossSalesFormatted: formatCurrency(grossSales),
    platformCommission,
    platformCommissionFormatted: formatCurrency(platformCommission),
    deliveryBoyCharges,
    deliveryBoyChargesFormatted: formatCurrency(deliveryBoyCharges),
    netEarnings,
    netEarningsFormatted: formatCurrency(netEarnings),
    netBalance,
    netBalanceFormatted: formatCurrency(netBalance),
    balanceCreditsTotal,
    balanceCreditsFormatted: formatCurrency(balanceCreditsTotal),
    balanceDebitsTotal,
    balanceDebitsFormatted: formatCurrency(balanceDebitsTotal),
    totalAdClicks,
  })
}
