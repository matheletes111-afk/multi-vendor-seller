import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { sendSellerApprovalEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const { id } = await params

    const seller = await prisma.seller.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } }
    })

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    await prisma.seller.update({
      where: { id },
      data: { isApproved: true },
    })

    // ── Send Email Notification ───────────────────────────────────────────────
    try {
      if (seller.user?.email) {
        await sendSellerApprovalEmail({
          to: seller.user.email,
          name: seller.user.name ?? "Seller",
        })
      }
    } catch (emailErr) {
      console.error("Failed to send seller approval email:", emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to approve seller" }, { status: 500 })
  }
}

