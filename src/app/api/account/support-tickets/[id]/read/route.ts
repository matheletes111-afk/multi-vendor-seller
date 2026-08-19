import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { id } = await params
    const userEmail = session.user.email?.toLowerCase().trim()
    const userId = session.user.id

    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        AND: [
          { OR: [{ id }, { ticketId: id }] },
          { source: "IN_APP" },
          {
            OR: [
              ...(userId ? [{ userId }] : []),
              ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" } }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
    }

    await (prisma as any).supportTicket.update({
      where: { id: ticket.id },
      data: { userLastReadAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error marking ticket as read by user:", error)
    return NextResponse.json({ error: error?.message || "Failed to mark as read." }, { status: 500 })
  }
}
