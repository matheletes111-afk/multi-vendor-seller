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
      totalRevenue,
      pendingSellers,
    ] = await Promise.all([
      prisma.seller.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.service.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.commission.aggregate({
        _sum: { amount: true },
      }),
      prisma.seller.count({ where: { isApproved: false } }),
    ])

    return NextResponse.json({
      totalSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      totalRevenue: totalRevenue._sum.amount ?? 0,
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
