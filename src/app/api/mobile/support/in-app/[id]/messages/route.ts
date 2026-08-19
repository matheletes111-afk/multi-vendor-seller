import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/mobile/support/in-app/[id]/messages
 * Sends a new message in an active support conversation thread
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const body = await req.json().catch(() => ({}))
    const { message, userId: bodyUserId, senderName: bodyName, senderEmail: bodyEmail } = body

    const headerUserId = req.headers.get("x-user-id")?.trim()
    const headerEmail = req.headers.get("x-user-email")?.toLowerCase().trim()

    const userId = session?.user?.id || bodyUserId || headerUserId || null
    const userEmail = session?.user?.email?.toLowerCase().trim() || bodyEmail?.toLowerCase().trim() || headerEmail || null
    const userName = session?.user?.name || bodyName?.trim() || "User"

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 })
    }

    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        source: "IN_APP",
        OR: [{ id }, { ticketId: id }],
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "In-app support ticket not found." }, { status: 404 })
    }

    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return NextResponse.json(
        {
          error: "This support ticket has been marked as Resolved. No further messages are allowed. Please start a new support conversation.",
          isResolved: true,
        },
        { status: 400 }
      )
    }

    // Append reply
    const reply = await (prisma as any).supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        senderType: "USER",
        senderEmail: userEmail || ticket.email,
        senderName: userName || ticket.name,
        message: message.trim(),
        sentEmail: false,
      },
    })

    const updatedTicket = await (prisma as any).supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status === "OPEN" ? "PENDING" : ticket.status,
        updatedAt: new Date(),
        userLastReadAt: new Date(),
      },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Message sent successfully.",
      reply,
      ticket: {
        ...updatedTicket,
        unreadCount: 0,
        messageCount: (updatedTicket.replies?.length ?? 0) + 1,
      },
    })
  } catch (error: any) {
    console.error("Error in POST /api/mobile/support/in-app/[id]/messages:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send message." },
      { status: 500 }
    )
  }
}
