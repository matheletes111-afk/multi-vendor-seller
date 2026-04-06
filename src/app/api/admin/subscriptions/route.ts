import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isValid } from "date-fns"

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

    const yearString = searchParams.get("year")
    const monthString = searchParams.get("month")
    const fromString = searchParams.get("from")
    const toString = searchParams.get("to")

    let dateFilter: any = {}

    if (fromString || toString) {
      if (fromString) {
        const fromDate = parseISO(fromString)
        if (isValid(fromDate)) dateFilter.gte = fromDate
      }
      if (toString) {
        const toDate = parseISO(toString)
        if (isValid(toDate)) dateFilter.lte = toDate
      }
    } else if (yearString) {
      const year = parseInt(yearString, 10)
      if (!isNaN(year)) {
        if (monthString) {
          const month = parseInt(monthString, 10) - 1 // 0-indexed
          if (!isNaN(month) && month >= 0 && month <= 11) {
            const date = new Date(year, month, 1)
            dateFilter.gte = startOfMonth(date)
            dateFilter.lte = endOfMonth(date)
          }
        } else {
          const date = new Date(year, 0, 1)
          dateFilter.gte = startOfYear(date)
          dateFilter.lte = endOfYear(date)
        }
      }
    }

    const where: any = {}
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter
    }

    const [
      subscriptions,
      totalCount,
      activeCount,
      filteredForRevenue,
      plans,
      planCounts,
      planActiveCounts,
    ] = await Promise.all([
      prisma.subscription.findMany({
        where,
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
      prisma.subscription.count({ where }),
      prisma.subscription.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.subscription.findMany({
        where,
        select: { plan: { select: { price: true } } },
      }),
      prisma.plan.findMany({ orderBy: { price: "asc" } }),
      prisma.subscription.groupBy({ 
        by: ["planId"], 
        where,
        _count: true 
      }),
      prisma.subscription.groupBy({
        by: ["planId"],
        where: { ...where, status: "ACTIVE" },
        _count: true,
      }),
    ])

    const totalRevenue = filteredForRevenue.reduce((sum, s) => sum + s.plan.price, 0)
    const planCountMap = Object.fromEntries(planCounts.map((p: any) => [p.planId, p._count]))
    const planActiveMap = Object.fromEntries(planActiveCounts.map((p: any) => [p.planId, p._count]))
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
