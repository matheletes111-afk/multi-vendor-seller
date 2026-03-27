import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"
import { serviceSellerItemsNet, serviceSellerLineGross } from "@/lib/service-seller-order-money"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  const [subscription, totalServices, totalOrders, serviceLines] = await Promise.all([
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
        subtotalInclGst: true,
        subtotal: true,
        gstAmount: true,
        shippingAmount: true,
        commissionAmount: true,
      },
    }),
  ])

  const platformCommissionTotal = serviceLines.reduce((s, i) => s + i.commissionAmount, 0)
  const sellerGrossTotal = serviceLines.reduce((s, i) => s + serviceSellerLineGross(i), 0)
  const sellerNetTotal = serviceSellerItemsNet(serviceLines)

  return NextResponse.json({
    subscription: subscription ? { ...subscription, plan: subscription.plan } : null,
    totalServices,
    totalOrders,
    /** Gross value of your service lines (before platform fee). */
    sellerGrossTotal,
    sellerGrossFormatted: formatCurrency(sellerGrossTotal),
    /** Sum of platform commission on your service lines (fees). */
    platformCommissionTotal,
    platformCommissionFormatted: formatCurrency(platformCommissionTotal),
    /** Your estimated net from all service order lines: gross − platform commission. No product-style return/exchange wallet adjustments. */
    sellerNetTotal,
    sellerNetFormatted: formatCurrency(sellerNetTotal),
  })
}
