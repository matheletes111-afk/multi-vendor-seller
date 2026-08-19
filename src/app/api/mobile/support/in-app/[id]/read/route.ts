import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/mobile/support/in-app/[id]/read
 * Explicitly marks an in-app support conversation as read and zeroes out unread count
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const body = await req.json().catch(() => ({}))
    const { userId: bodyUserId } = body
    const headerUserId = req.headers.get("x-user-id")?.trim()
    const userId = session?.user?.id || bodyUserId || headerUserId || null

    const ticket = await (prisma as any).supportTicket.findFirst({
      where: {
        source: "IN_APP",
        OR: [{ id }, { ticketId: id }],
      },
      select: { id: true, ticketId: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: "In-app support ticket not found." }, { status: 404 })
    }

    await (prisma as any).supportTicket.update({
      where: { id: ticket.id },
      data: { userLastReadAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      ticketId: ticket.ticketId,
      message: "Ticket marked as read successfully.",
      userLastReadAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in POST /api/mobile/support/in-app/[id]/read:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to mark ticket as read." },
      { status: 500 }
    )
  }
}
