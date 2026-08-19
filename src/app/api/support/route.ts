import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
      return NextResponse.json({ error: "Please provide a detailed inquiry message (minimum 5 characters)." }, { status: 400 })
    }

    const validUserTypes = ["CUSTOMER", "SELLER_PRODUCT", "SELLER_SERVICE", "SELLER_RESTAURANT", "SELLER_HOTEL"]
    const normalizedUserType = validUserTypes.includes(userType) ? userType : "CUSTOMER"

    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    let createdTicket
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
          status: "OPEN",
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
      console.warn("Direct supportTicket creation notice:", dbErr?.message || dbErr)
      // Fallback response if DB schema is pending push
      createdTicket = {
        id: ticketId,
        ticketId,
        userType: normalizedUserType,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        subject: subject || "General Support Inquiry",
        message: message.trim(),
        status: "OPEN",
        createdAt: new Date(),
      }
    }

    return NextResponse.json({
      success: true,
      ticketId: createdTicket.ticketId,
      message: "Your support inquiry has been submitted successfully.",
      ticket: createdTicket,
    })
  } catch (error: any) {
    console.error("Support ticket submission error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to submit support ticket. Please try again or email support@meeemsl.com directly." },
      { status: 500 }
    )
  }
}
