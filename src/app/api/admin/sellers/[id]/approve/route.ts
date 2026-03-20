import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

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
      select: { nationIdentityNumber: true },
    })

    const nid = seller?.nationIdentityNumber?.trim()
    if (!nid) {
      return NextResponse.json(
        { error: "Nation Identity Number is required before approval." },
        { status: 400 }
      )
    }

    await prisma.seller.update({
      where: { id },
      data: { isApproved: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to approve seller" }, { status: 500 })
  }
}

