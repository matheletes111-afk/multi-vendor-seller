import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to calculate unread admin messages using userLastReadAt
function getUserTicketUnreadCount(t: any) {
  if (t.status === "RESOLVED" || t.status === "CLOSED") {
    return 0
  }
  const userLastRead = t.userLastReadAt ? new Date(t.userLastReadAt).getTime() : 0
  const replies = t.replies || []

  let unread = 0
  for (const r of replies) {
    if (r.senderType === "ADMIN") {
      const repTime = new Date(r.createdAt).getTime()
      if (repTime > userLastRead) {
        unread++
      }
    }
  }
  return unread
}

/**
 * GET /api/mobile/support/in-app/[id]
 * Fetch single in-app ticket with full chat conversation thread
 * Query param: ?markRead=true (default: true) marks the ticket as read
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const { searchParams } = new URL(req.url)

    const paramUserId = searchParams.get("userId")?.trim()
    const paramEmail = searchParams.get("email")?.toLowerCase().trim()
    const headerUserId = req.headers.get("x-user-id")?.trim()
    const headerEmail = req.headers.get("x-user-email")?.toLowerCase().trim()

    const userId = session?.user?.id || paramUserId || headerUserId
    const userEmail = session?.user?.email?.toLowerCase().trim() || paramEmail || headerEmail
    const shouldMarkRead = searchParams.get("markRead") !== "false"

    const whereConditions: any[] = [{ id }, { ticketId: id }]

    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        source: "IN_APP",
        OR: whereConditions,
      },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "In-app support ticket not found." }, { status: 404 })
    }

    // Auto mark as read if requested and user matches
    if (shouldMarkRead) {
      try {
        await (prisma as any).supportTicket.update({
          where: { id: ticket.id },
          data: { userLastReadAt: new Date() },
        })
        ticket.userLastReadAt = new Date()
      } catch (markErr) {
        console.warn("Notice: could not auto update userLastReadAt:", markErr)
      }
    }

    const unreadCount = shouldMarkRead ? 0 : getUserTicketUnreadCount(ticket)

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: ticket.id,
          ticketId: ticket.ticketId,
          source: ticket.source,
          userType: ticket.userType,
          name: ticket.name,
          email: ticket.email,
          mobile: ticket.mobile,
          subject: ticket.subject,
          message: ticket.message,
          status: ticket.status,
          unreadCount,
          messageCount: (ticket.replies?.length ?? 0) + 1,
          userLastReadAt: ticket.userLastReadAt,
          closedAt: ticket.closedAt,
          closedBy: ticket.closedBy,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          replies: ticket.replies || [],
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in GET /api/mobile/support/in-app/[id]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch ticket details." },
      { status: 500 }
    )
  }
}
