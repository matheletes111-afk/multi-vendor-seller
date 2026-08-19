import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to calculate unread user messages using adminLastReadAt and latestAdminReply
function getTicketUnreadCount(t: any) {
  if (t.status === "RESOLVED" || t.status === "CLOSED") {
    return 0
  }
  const adminLastRead = t.adminLastReadAt ? new Date(t.adminLastReadAt).getTime() : 0
  const replies = t.replies || []

  // If no replies exist at all
  if (replies.length === 0) {
    const createdTime = new Date(t.createdAt).getTime()
    return createdTime > adminLastRead ? 1 : 0
  }

  // Find timestamp of the latest ADMIN reply (if any)
  let latestAdminReplyTime = 0
  for (let i = replies.length - 1; i >= 0; i--) {
    if (replies[i].senderType === "ADMIN") {
      latestAdminReplyTime = new Date(replies[i].createdAt).getTime()
      break
    }
  }

  // The effective "read" threshold is the MAX of adminLastReadAt and latestAdminReplyTime
  const readThreshold = Math.max(adminLastRead, latestAdminReplyTime)

  let unread = 0
  for (const r of replies) {
    if (r.senderType === "USER") {
      const repTime = new Date(r.createdAt).getTime()
      if (repTime > readThreshold) {
        unread++
      }
    }
  }
  return unread
}

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
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const query = searchParams.get("query")?.trim().toLowerCase() || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    const skip = (page - 1) * limit

    const where: any = {}
    if (source === "IN_APP") {
      where.source = "IN_APP"
    } else if (source === "PUBLIC") {
      where.source = { not: "IN_APP" }
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
      unread: 0,
    }

    try {
      tickets = await (prisma as any).supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
      totalCount = await (prisma as any).supportTicket.count({ where })
    } catch (fetchErr: any) {
      console.error("Error fetching support tickets findMany:", fetchErr?.message || fetchErr)
      try {
        tickets = await (prisma as any).supportTicket.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            replies: {
              orderBy: { createdAt: "asc" },
            },
          },
        })
        totalCount = tickets.length
      } catch (fallbackErr: any) {
        console.error("Fallback findMany failed:", fallbackErr?.message || fallbackErr)
        tickets = []
        totalCount = 0
      }
    }

    // Attach unreadCount to each ticket
    let ticketsWithUnread = tickets.map((t) => ({
      ...t,
      unreadCount: getTicketUnreadCount(t),
    }))

    if (unreadOnly) {
      ticketsWithUnread = ticketsWithUnread.filter((t) => t.unreadCount > 0)
    }

    // Safe stats calculation
    try {
      const [allTickets, inAppCount] = await Promise.all([
        (prisma as any).supportTicket.findMany({
          select: {
            id: true,
            status: true,
            source: true,
            createdAt: true,
            adminLastReadAt: true,
            replies: {
              select: { senderType: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
        (prisma as any).supportTicket.count({
          where: { source: "IN_APP" },
        }).catch(() => 0),
      ])

      let pendingCount = 0
      let inProgressCount = 0
      let resolvedCount = 0
      let closedCount = 0
      let unreadTotal = 0

      for (const item of allTickets) {
        if (item.status === "PENDING" || item.status === "OPEN") pendingCount++
        else if (item.status === "IN_PROGRESS") inProgressCount++
        else if (item.status === "RESOLVED") resolvedCount++
        else if (item.status === "CLOSED") closedCount++

        if (getTicketUnreadCount(item) > 0) {
          unreadTotal++
        }
      }

      stats = {
        total: allTickets.length,
        open: pendingCount,
        inProgress: inProgressCount,
        closed: closedCount + resolvedCount,
        inApp: inAppCount,
        public: Math.max(0, allTickets.length - inAppCount),
        unread: unreadTotal,
      }
    } catch (statsErr: any) {
      console.warn("Stats calculation warning:", statsErr?.message || statsErr)
      stats = {
        total: tickets.length,
        open: tickets.filter((t) => t.status === "PENDING" || t.status === "OPEN").length,
        inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
        closed: tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
        inApp: tickets.filter((t) => t.source === "IN_APP").length,
        public: tickets.filter((t) => t.source !== "IN_APP").length,
        unread: ticketsWithUnread.filter((t) => t.unreadCount > 0).length,
      }
    }

    return NextResponse.json(
      {
        tickets: ticketsWithUnread,
        totalCount: unreadOnly ? ticketsWithUnread.length : totalCount,
        page,
        limit,
        stats,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in GET /api/admin/support:", error)
    return NextResponse.json({ error: error?.message || "Failed to fetch support tickets." }, { status: 500 })
  }
}
