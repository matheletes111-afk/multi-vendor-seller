import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"
import { serviceSellerItemsNet, serviceSellerLineGross } from "@/lib/service-seller-order-money"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [seller, globalSetting] = await Promise.all([
    prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true, commissionRate: true } }),
    prisma.globalSetting.findFirst(),
  ])
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  const [subscription, totalServices, totalOrders, serviceLines, totalAdClicks] = await Promise.all([
    prisma.subscription.findFirst({ where: { sellerId: seller.id }, include: { plan: true } }),
    prisma.service.count({ where: { sellerId: seller.id, isActive: true } }),
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
        createdAt: true,
        subtotalInclGst: true,
        subtotal: true,
        gstAmount: true,
        shippingAmount: true,
        commissionAmount: true,
        serviceNameSnapshot: true,
        order: {
          select: { orderNumber: true }
        }
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adClick.count({
      where: {
        ad: {
          sellerId: seller.id
        }
      }
    })
  ])

  // For now, platform fees are not deducted; all is credited to the seller.
  const platformCommissionTotal = 0
  const sellerGrossTotal = serviceLines.reduce((s, i) => s + serviceSellerLineGross(i as any), 0)
  const sellerNetTotal = sellerGrossTotal

  const creditList = serviceLines.map(i => {
    const grossVal = serviceSellerLineGross(i as any)
    return {
      id: i.id,
      orderId: i.orderId,
      orderNumber: i.order?.orderNumber || "Unknown",
      serviceName: i.serviceNameSnapshot || "Service",
      createdAt: i.createdAt,
      gross: grossVal,
      grossFormatted: formatCurrency(grossVal)
    }
  })

  return NextResponse.json({
    subscription: subscription ? { ...subscription, plan: subscription.plan } : null,
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
    creditList,
    totalAdClicks,
  })
}
