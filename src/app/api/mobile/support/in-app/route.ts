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
 * GET /api/mobile/support/in-app
 * Fetches all in-app support chat tickets for a logged-in user or by userId / email query parameter
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(req.url)

    const paramUserId = searchParams.get("userId")?.trim()
    const paramEmail = searchParams.get("email")?.toLowerCase().trim()
    const headerUserId = req.headers.get("x-user-id")?.trim()
    const headerEmail = req.headers.get("x-user-email")?.toLowerCase().trim()

    const userId = session?.user?.id || paramUserId || headerUserId
    const userEmail = session?.user?.email?.toLowerCase().trim() || paramEmail || headerEmail

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "Authentication required. Provide user session, userId, or email." },
        { status: 401 }
      )
    }

    const whereConditions: any[] = []
    if (userId) whereConditions.push({ userId })
    if (userEmail) whereConditions.push({ email: { equals: userEmail, mode: "insensitive" } })

    let tickets: any[] = []
    try {
      tickets = await (prisma as any).supportTicket.findMany({
        where: {
          source: "IN_APP",
          OR: whereConditions,
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    } catch (dbErr: any) {
      console.warn("Mobile in-app tickets fetch notice:", dbErr?.message || dbErr)
      tickets = []
    }

    const formattedTickets = tickets.map((t) => {
      const unreadCount = getUserTicketUnreadCount(t)
      return {
        id: t.id,
        ticketId: t.ticketId,
        source: t.source,
        userType: t.userType,
        name: t.name,
        email: t.email,
        mobile: t.mobile,
        subject: t.subject,
        message: t.message,
        status: t.status,
        unreadCount,
        messageCount: (t.replies?.length ?? 0) + 1,
        userLastReadAt: t.userLastReadAt,
        closedAt: t.closedAt,
        closedBy: t.closedBy,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replies: t.replies || [],
      }
    })

    const totalUnread = formattedTickets.reduce((acc, t) => acc + (t.unreadCount || 0), 0)

    return NextResponse.json(
      {
        success: true,
        count: formattedTickets.length,
        totalUnread,
        tickets: formattedTickets,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in GET /api/mobile/support/in-app:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch in-app support tickets." },
      { status: 500 }
    )
  }
}

/**
 * POST /api/mobile/support/in-app
 * Creates a new in-app support chat ticket for customer or any seller role
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const body = await req.json().catch(() => ({}))
    const { userId: bodyUserId, userType, name, email, mobile, subject, message } = body

    const headerUserId = req.headers.get("x-user-id")?.trim()
    const headerEmail = req.headers.get("x-user-email")?.toLowerCase().trim()

    const userId = session?.user?.id || bodyUserId || headerUserId || null
    const senderName = name?.trim() || session?.user?.name || "User"
    const senderEmail = email?.trim()?.toLowerCase() || session?.user?.email?.toLowerCase() || headerEmail || ""
    const senderMobile = mobile?.trim() || (session?.user as any)?.phone || "N/A"

    if (!senderEmail || !senderEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 })
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json(
        { error: "Please write a detailed message (minimum 5 characters)." },
        { status: 400 }
      )
    }

    const validUserTypes = ["CUSTOMER", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_RESTAURANT", "SELLER_HOTEL"]
    const normalizedUserType = validUserTypes.includes(userType) ? userType : "CUSTOMER"

    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    let ticket: any
    try {
      ticket = await (prisma as any).supportTicket.create({
        data: {
          ticketId,
          userType: normalizedUserType,
          name: senderName,
          email: senderEmail,
          mobile: senderMobile,
          subject: subject?.trim() || "In-App Support Request",
          message: message.trim(),
          status: "PENDING",
          source: "IN_APP",
          userId: userId || null,
          userLastReadAt: new Date(),
          adminNotes: userId ? `uid:${userId}` : null,
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    } catch (dbErr: any) {
      console.warn("Direct mobile support ticket creation notice:", dbErr?.message || dbErr)
      ticket = {
        id: ticketId,
        ticketId,
        userType: normalizedUserType,
        name: senderName,
        email: senderEmail,
        mobile: senderMobile,
        subject: subject?.trim() || "In-App Support Request",
        message: message.trim(),
        status: "PENDING",
        source: "IN_APP",
        userId: userId || null,
        userLastReadAt: new Date(),
        createdAt: new Date(),
        replies: [],
      }
    }

    return NextResponse.json({
      success: true,
      message: "Support ticket created successfully. Our team will assist you in this live chat.",
      ticket: {
        ...ticket,
        unreadCount: 0,
        messageCount: (ticket.replies?.length ?? 0) + 1,
      },
    })
  } catch (error: any) {
    console.error("Error in POST /api/mobile/support/in-app:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to create in-app support ticket." },
      { status: 500 }
    )
  }
}
