import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"

/** GET dashboard overview. */
export async function GET() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const [subscription, totalProducts, totalOrders, totalRevenue] = await Promise.all([
    prisma.subscription.findFirst({
      where: { sellerId: seller.id },
      include: { plan: true },
    }),
    prisma.product.count({ where: { sellerId: seller.id, isActive: true } }),
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
  ])

  return NextResponse.json({
    subscription: subscription ? { ...subscription, plan: subscription.plan } : null,
    totalProducts,
    totalOrders,
    totalRevenue: totalRevenue._sum.commissionAmount ?? 0,
    totalRevenueFormatted: formatCurrency(totalRevenue._sum.commissionAmount ?? 0),
  })
}
