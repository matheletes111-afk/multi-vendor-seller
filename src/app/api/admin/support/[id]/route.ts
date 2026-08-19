import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 })
    }

    const { id } = await params

    let ticket: any = null
    try {
      ticket = await (prisma as any).supportTicket.findFirst({
        where: {
          OR: [{ id }, { ticketId: id }],
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    } catch (dbErr: any) {
      console.warn("Support ticket details query notice:", dbErr?.message || dbErr)
    }

    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found." }, { status: 404 })
    }

    return NextResponse.json({ ticket })
  } catch (error: any) {
    console.error("Error fetching support ticket details:", error)
    return NextResponse.json({ error: error?.message || "Failed to fetch support ticket details." }, { status: 500 })
  }
}

export async function PATCH(
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
    const { status, adminNotes } = body

    const updateData: any = {}
    if (status) {
      updateData.status = status
      if (status === "CLOSED" || status === "RESOLVED") {
        updateData.closedAt = new Date()
        updateData.closedBy = session.user?.email || "Admin"
      }
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes
    }

    const updated = await (prisma as any).supportTicket.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, ticket: updated })
  } catch (error: any) {
    console.error("Error updating support ticket status:", error)
    return NextResponse.json({ error: error?.message || "Failed to update support ticket." }, { status: 500 })
  }
}
