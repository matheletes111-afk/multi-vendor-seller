import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { message } = body

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 })
    }

    const userEmail = session.user.email?.toLowerCase().trim()
    const userId = session.user.id

    // Find ticket - owned by this user (by userId or email)
    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        AND: [
          { OR: [{ id }, { ticketId: id }] },
          { source: "IN_APP" },
          {
            OR: [
              ...(userId ? [{ userId: userId }] : []),
              ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" } }] : []),
            ],
          },
        ],
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found or access denied." }, { status: 404 })
    }

    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return NextResponse.json(
        { error: "This support ticket has been resolved and closed. No further messages are allowed. Please create a new ticket if you need additional assistance." },
        { status: 400 }
      )
    }

    // Append reply
    const reply = await (prisma as any).supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        senderType: "USER",
        senderEmail: session.user.email || ticket.email,
        senderName: session.user.name || ticket.name,
        message: message.trim(),
        sentEmail: false,
      },
    })

    const updatedTicket = await (prisma as any).supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status === "OPEN" ? "PENDING" : ticket.status,
        updatedAt: new Date(),
        userLastReadAt: new Date(), // user is actively writing, so mark as read
      },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      reply,
    })
  } catch (error: any) {
    console.error("Error in POST /api/account/support-tickets/[id]/messages:", error)
    return NextResponse.json({ error: error?.message || "Failed to send message." }, { status: 500 })
  }
}
