import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const source = searchParams.get("source") || "ALL"
    const status = searchParams.get("status") || "ALL"
    const userType = searchParams.get("userType") || "ALL"
    const query = searchParams.get("query")?.trim().toLowerCase() || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (source === "IN_APP") {
      where.source = "IN_APP"
    } else if (source === "PUBLIC") {
      where.OR = [
        { source: "PUBLIC" },
        { source: null },
      ]
    }

    if (status !== "ALL") {
      if (status === "PENDING") {
        where.status = { in: ["PENDING", "OPEN"] }
      } else if (status === "RESOLVED") {
        where.status = { in: ["RESOLVED", "CLOSED"] }
      } else {
        where.status = status
      }
    }

    if (userType !== "ALL") {
      where.userType = userType
    }

    if (query) {
      const searchConditions = [
        { ticketId: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { mobile: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
      ]
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    let tickets: any[] = []
    let totalCount = 0
    let stats = {
      total: 0,
      open: 0,
      inProgress: 0,
      closed: 0,
      inApp: 0,
      public: 0,
    }

    try {
      const [data, total, allCounts, inAppCount, publicCount] = await Promise.all([
        (prisma as any).supportTicket.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            replies: {
              orderBy: { createdAt: "asc" },
            },
          },
        }),
        (prisma as any).supportTicket.count({ where }),
        (prisma as any).supportTicket.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
        (prisma as any).supportTicket.count({
          where: { source: "IN_APP" },
        }),
        (prisma as any).supportTicket.count({
          where: { OR: [{ source: "PUBLIC" }, { source: null }] },
        }),
      ])

      tickets = data
      totalCount = total

      let pendingCount = 0
      let inProgressCount = 0
      let resolvedCount = 0
      let closedCount = 0
      let totalAll = 0

      for (const item of allCounts) {
        const count = item._count.status
        totalAll += count
        if (item.status === "PENDING" || item.status === "OPEN") pendingCount += count
        if (item.status === "IN_PROGRESS") inProgressCount += count
        if (item.status === "RESOLVED") resolvedCount += count
        if (item.status === "CLOSED") closedCount += count
      }

      stats = {
        total: totalAll,
        open: pendingCount,
        inProgress: inProgressCount,
        closed: closedCount + resolvedCount,
        inApp: inAppCount,
        public: publicCount,
      }
    } catch (dbErr: any) {
      console.warn("Support tickets query notice:", dbErr?.message || dbErr)
      tickets = []
      totalCount = 0
      stats = { total: 0, open: 0, inProgress: 0, closed: 0, inApp: 0, public: 0 }
    }

    return NextResponse.json({
      tickets,
      totalCount,
      page,
      limit,
      stats,
    })
  } catch (error: any) {
    console.error("Error in GET /api/admin/support:", error)
    return NextResponse.json({ error: error?.message || "Failed to fetch support tickets." }, { status: 500 })
  }
}
