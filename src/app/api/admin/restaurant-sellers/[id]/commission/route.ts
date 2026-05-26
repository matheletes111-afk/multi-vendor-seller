import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { commissionRate } = body

  if (commissionRate !== undefined && commissionRate !== null) {
      const rate = parseFloat(commissionRate)
      if (isNaN(rate) || rate < 0 || rate > 100) {
          return NextResponse.json({ error: "Invalid commission rate. Must be between 0 and 100." }, { status: 400 })
      }
  }

  try {
    const restaurantSeller = await prisma.restaurantSeller.update({
      where: { id },
      data: {
        commissionRate: commissionRate !== null ? parseFloat(commissionRate) : null,
      },
    })

    return NextResponse.json({ success: true, restaurantSeller })
  } catch (error) {
    console.error("Failed to update restaurant seller commission:", error)
    return NextResponse.json({ error: "Failed to update restaurant seller commission" }, { status: 500 })
  }
}
