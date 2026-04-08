import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [
      totalSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      adAgg,
      subscriptionPlans,
      pendingSellers,
    ] = await Promise.all([
      prisma.seller.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.service.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.sellerAd.aggregate({
        _sum: { spentAmount: true }
      }),
      prisma.plan.findMany({
        where: { price: { gt: 0 } },
        include: { _count: { select: { subscriptions: true } } }
      }),
      prisma.seller.count({ where: { isApproved: false } }),
    ])

    const adRevenue = Number(adAgg._sum.spentAmount ?? 0)
    const subscriptionRevenue = subscriptionPlans.reduce((sum, plan) => sum + (plan.price * plan._count.subscriptions), 0)
    const commissionRevenue = 0 // Commission is handled separately for now

    // Total platform revenue is Subscription + Ad revenue
    const totalPlatformRevenue = subscriptionRevenue + adRevenue

    return NextResponse.json({
      totalSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      totalRevenue: totalPlatformRevenue,
      subscriptionRevenue,
      adRevenue,
      commissionRevenue,
      pendingSellers,
    })
  } catch (error) {
    console.error("Error fetching admin overview:", error)
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    )
  }
}
