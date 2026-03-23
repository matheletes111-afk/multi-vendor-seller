import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { formatCurrency } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  const [subscription, totalServices, totalOrders, totalRevenue] = await Promise.all([
    prisma.subscription.findFirst({ where: { sellerId: seller.id }, include: { plan: true } }),
    prisma.service.count({ where: { sellerId: seller.id, isActive: true } }),
    prisma.order.count({
      where: {
        items: {
          some: { sellerId: seller.id, serviceId: { not: null } },
        },
      },
    }),
    prisma.orderItem.aggregate({
      where: {
        sellerId: seller.id,
        serviceId: { not: null },
      },
      _sum: { commissionAmount: true },
    }),
  ])
  return NextResponse.json({
    subscription: subscription ? { ...subscription, plan: subscription.plan } : null,
    totalServices,
    totalOrders,
    totalRevenue: totalRevenue._sum.commissionAmount ?? 0,
    totalRevenueFormatted: formatCurrency(totalRevenue._sum.commissionAmount ?? 0),
  })
}
