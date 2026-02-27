import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const [
      subscriptions,
      totalCount,
      activeCount,
      activeForRevenue,
      plans,
      planCounts,
      planActiveCounts,
    ] = await Promise.all([
      prisma.subscription.findMany({
        skip,
        take,
        include: {
          seller: {
            include: {
              user: true,
              store: true,
            },
          },
          plan: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        select: { plan: { select: { price: true } } },
      }),
      prisma.plan.findMany({ orderBy: { price: "asc" } }),
      prisma.subscription.groupBy({ by: ["planId"], _count: true }),
      prisma.subscription.groupBy({
        by: ["planId"],
        where: { status: "ACTIVE" },
        _count: true,
      }),
    ])

    const totalRevenue = activeForRevenue.reduce((sum, s) => sum + s.plan.price, 0)
    const planCountMap = Object.fromEntries(planCounts.map((p) => [p.planId, p._count]))
    const planActiveMap = Object.fromEntries(planActiveCounts.map((p) => [p.planId, p._count]))
    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      subscriptions,
      totalCount,
      totalPages,
      page,
      perPage,
      stats: {
        totalCount,
        activeCount,
        totalRevenue,
        plansCount: plans.length,
      },
      plans,
      planCountMap,
      planActiveMap,
    })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}
