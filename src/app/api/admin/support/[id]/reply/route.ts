import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSupportTicketReplyEmail } from "@/lib/email"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { replyMessage, closeTicket = true } = body

    if (!replyMessage || typeof replyMessage !== "string" || !replyMessage.trim()) {
      return NextResponse.json({ error: "Reply message cannot be empty." }, { status: 400 })
    }

    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        OR: [{ id }, { ticketId: id }],
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
    }

    // 1. Create Reply Record
    const replyRecord = await (prisma as any).supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        senderType: "ADMIN",
        senderEmail: session.user?.email || "support@meeemsl.com",
        senderName: session.user?.name || "MEEEM Admin Support",
        message: replyMessage.trim(),
        sentEmail: true,
      },
    })

    // 2. Update Ticket Status (mark as RESOLVED if requested)
    const newStatus = closeTicket ? "RESOLVED" : "IN_PROGRESS"
    const updatePayload: any = {
      status: newStatus,
    }
    if (closeTicket) {
      updatePayload.closedAt = new Date()
      updatePayload.closedBy = session.user?.email || "Admin"
    }

    const updatedTicket = await (prisma as any).supportTicket.update({
      where: { id: ticket.id },
      data: updatePayload,
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    // 3. Dispatch Email Notification
    let emailResult = { success: false }
    try {
      if (ticket.email) {
        emailResult = await sendSupportTicketReplyEmail({
          to: ticket.email,
          recipientName: ticket.name || "Customer",
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          replyMessage: replyMessage.trim(),
          isClosed: closeTicket,
        })
      }
    } catch (emailErr) {
      console.warn("Failed to dispatch email reply notification:", emailErr)
    }

    return NextResponse.json({
      success: true,
      message: `Reply sent successfully${closeTicket ? " and ticket marked as closed" : ""}.`,
      ticket: updatedTicket,
      reply: replyRecord,
      emailSent: emailResult?.success ?? false,
    })
  } catch (error: any) {
    console.error("Error replying to support ticket:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send support ticket reply." },
      { status: 500 }
    )
  }
}
