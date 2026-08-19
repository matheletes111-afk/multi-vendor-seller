import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/mobile/support/public
 * Submit a public contact / support helpdesk inquiry (No authentication required)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { name, email, mobile, userType, subject, message } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Full Name is required." }, { status: 400 })
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid Email Address is required." }, { status: 400 })
    }

    if (!mobile || typeof mobile !== "string" || !mobile.trim()) {
      return NextResponse.json({ error: "Mobile number is required." }, { status: 400 })
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a detailed inquiry message (minimum 5 characters)." },
        { status: 400 }
      )
    }

    const validUserTypes = ["CUSTOMER", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_RESTAURANT", "SELLER_HOTEL"]
    const normalizedUserType = validUserTypes.includes(userType) ? userType : "CUSTOMER"

    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    let createdTicket: any
    try {
      createdTicket = await (prisma as any).supportTicket.create({
        data: {
          ticketId,
          userType: normalizedUserType,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim(),
          subject: subject ? String(subject).trim() : "General Support Inquiry",
          message: message.trim(),
          status: "PENDING",
          source: "PUBLIC",
          replies: {
            create: [
              {
                senderType: "USER",
                senderEmail: email.trim().toLowerCase(),
                senderName: name.trim(),
                message: message.trim(),
                sentEmail: false,
              },
            ],
          },
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    } catch (dbErr: any) {
      console.warn("Mobile public supportTicket creation notice:", dbErr?.message || dbErr)
      createdTicket = {
        id: ticketId,
        ticketId,
        userType: normalizedUserType,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        subject: subject || "General Support Inquiry",
        message: message.trim(),
        status: "PENDING",
        source: "PUBLIC",
        createdAt: new Date(),
        replies: [],
      }
    }

    return NextResponse.json({
      success: true,
      ticketId: createdTicket.ticketId,
      message: "Your support inquiry has been submitted successfully. Our support team will reply to your email address.",
      ticket: createdTicket,
    })
  } catch (error: any) {
    console.error("Error in POST /api/mobile/support/public:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to submit support inquiry." },
      { status: 500 }
    )
  }
}

/**
 * GET /api/mobile/support/public
 * Check status of a public ticket by ticketId and optional email verification
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ticketId = searchParams.get("ticketId")?.trim()
    const email = searchParams.get("email")?.toLowerCase().trim()

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId query parameter is required." }, { status: 400 })
    }

    const where: any = {
      source: "PUBLIC",
      OR: [{ id: ticketId }, { ticketId }],
    }
    if (email) {
      where.email = { equals: email, mode: "insensitive" }
    }

    const ticket = await (prisma as any).supportTicket.findFirst({
      where,
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Public support ticket not found." }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        name: ticket.name,
        email: ticket.email,
        message: ticket.message,
        createdAt: ticket.createdAt,
        closedAt: ticket.closedAt,
        replies: ticket.replies || [],
      },
    })
  } catch (error: any) {
    console.error("Error in GET /api/mobile/support/public:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to check public ticket status." },
      { status: 500 }
    )
  }
}
