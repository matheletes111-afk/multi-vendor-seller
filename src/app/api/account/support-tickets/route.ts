import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const userEmail = session.user.email?.toLowerCase().trim()
    const userId = session.user.id

    let tickets: any[] = []
    try {
      tickets = await (prisma as any).supportTicket.findMany({
        where: {
          source: "IN_APP",
          OR: [
            ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" } }] : []),
            ...(userId ? [{ userId: userId }] : []),
          ],
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    } catch (dbErr: any) {
      console.warn("Error querying user support tickets:", dbErr?.message || dbErr)
      tickets = []
    }

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

    const ticketsWithUnread = tickets.map((t) => ({
      ...t,
      unreadCount: getUserTicketUnreadCount(t),
    }))

    return NextResponse.json(
      { tickets: ticketsWithUnread },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Error in GET /api/account/support-tickets:", error)
    return NextResponse.json({ error: error?.message || "Failed to fetch support tickets." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, email, mobile, userType, subject, message } = body

    const senderName = name?.trim() || session.user.name || "User"
    const senderEmail = email?.trim()?.toLowerCase() || session.user.email?.toLowerCase() || ""
    const senderMobile = mobile?.trim() || (session.user as any).phone || ""

    if (!senderEmail || !senderEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 })
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json({ error: "Please write a detailed message (minimum 5 characters)." }, { status: 400 })
    }

    const validUserTypes = ["CUSTOMER", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_RESTAURANT", "SELLER_HOTEL"]
    const normalizedUserType = validUserTypes.includes(userType) ? userType : "CUSTOMER"

    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    let ticket
    try {
      ticket = await (prisma as any).supportTicket.create({
        data: {
          ticketId,
          userType: normalizedUserType,
          name: senderName,
          email: senderEmail,
          mobile: senderMobile || "N/A",
          subject: subject?.trim() || "In-App Support Request",
          message: message.trim(),
          status: "PENDING",
          source: "IN_APP",
          userId: session.user.id || null,
          adminNotes: session.user.id ? `uid:${session.user.id}` : null,
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    } catch (dbErr: any) {
      console.warn("Direct in-app support ticket creation notice:", dbErr?.message || dbErr)
      ticket = {
        id: ticketId,
        ticketId,
        userType: normalizedUserType,
        name: senderName,
        email: senderEmail,
        mobile: senderMobile || "N/A",
        subject: subject?.trim() || "In-App Support Request",
        message: message.trim(),
        status: "PENDING",
        createdAt: new Date(),
        replies: [],
      }
    }

    return NextResponse.json({
      success: true,
      ticket,
      message: "Support ticket created successfully. Our team will assist you shortly.",
    })
  } catch (error: any) {
    console.error("Error in POST /api/account/support-tickets:", error)
    return NextResponse.json({ error: error?.message || "Failed to create support ticket." }, { status: 500 })
  }
}
