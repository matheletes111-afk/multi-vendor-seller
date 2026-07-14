import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { formatCurrency } from "@/lib/utils"
import { deriveOrderStatus } from "@/lib/order-status"
import { serviceSellerLineGross } from "@/lib/service-seller-order-money"
import { getValidSubscription } from "@/lib/subscriptions"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
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

    const [subscription, totalServices, totalOrders, serviceLines, totalAdClicks] = await Promise.all([
      getValidSubscription(seller.id),
      prisma.service.count({ where: { sellerId: seller.id, isActive: true, isDeleted: false } }),
      prisma.order.count({
        where: {
          items: {
            some: { sellerId: seller.id, serviceId: { not: null } },
          },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          sellerId: seller.id,
          serviceId: { not: null },
        },
        select: {
          id: true,
          orderId: true,
          subtotalInclGst: true,
          subtotal: true,
          gstAmount: true,
          shippingAmount: true,
          commissionAmount: true,
        }
      }),
      prisma.adClick.count({
        where: {
          ad: {
            sellerId: seller.id
          }
        }
      })
    ])

    const platformCommissionTotal = serviceLines.reduce((s, i) => s + i.commissionAmount, 0)
    const sellerGrossTotal = serviceLines.reduce((s, i) => s + serviceSellerLineGross(i as any), 0)
    const sellerNetTotal = sellerGrossTotal // Following web logic where platform fees aren't deducted yet

    // Fetch recent 5 orders
    const recentOrdersRaw = await prisma.order.findMany({
      where: {
        items: {
          some: { sellerId: seller.id, serviceId: { not: null } },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        items: {
          where: { sellerId: seller.id, serviceId: { not: null } },
        },
      },
    })

    const recentOrders = recentOrdersRaw.map((order) => {
      const sellerSubtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
      let sellerCouponDiscount = 0
      if (order.couponDiscount && order.subtotal > 0) {
        sellerCouponDiscount = Number(((order.couponDiscount * sellerSubtotal) / order.subtotal).toFixed(2))
      }
      const sellerTotal = Math.max(0, order.items.reduce(
        (sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount,
        0
      ) - sellerCouponDiscount)
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

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          commissionRate: seller.commissionRate ?? globalSetting?.baseCommission ?? 0,
          isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
          totalServices,
          totalOrders,
          sellerGrossTotal,
          sellerGrossFormatted: formatCurrency(sellerGrossTotal),
          platformCommissionTotal,
          platformCommissionFormatted: formatCurrency(platformCommissionTotal),
          sellerNetTotal,
          sellerNetFormatted: formatCurrency(sellerNetTotal),
          netBalance,
          netBalanceFormatted: formatCurrency(netBalance),
          totalAdClicks,
        },
        subscription: subscription ? { id: subscription.id, status: subscription.status, plan: subscription.plan } : null,
        recentOrders,
      },
    })
  } catch (error) {
    console.error("Mobile service seller overview error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
