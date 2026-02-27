import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const { id } = await params
    const ad = await prisma.sellerAd.findUnique({ where: { id } })
    if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 })
    if (ad.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: "Ad is not pending approval" }, { status: 400 })
    }
    await prisma.sellerAd.update({
      where: { id },
      data: { status: "ACTIVE" },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to approve ad" },
      { status: 500 }
    )
  }
}
