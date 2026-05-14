import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, feedback } = await request.json()
    const params = await props.params
    const id = params.id

    if (action === "approve") {
      await prisma.restaurantSeller.update({
        where: { id },
        data: { isApproved: true, status: "APPROVED", onboardingCompleted: true }
      })
    } else if (action === "suspend") {
      await prisma.restaurantSeller.update({
        where: { id },
        data: { isSuspended: true }
      })
    } else if (action === "unsuspend") {
      await prisma.restaurantSeller.update({
        where: { id },
        data: { isSuspended: false }
      })
    } else if (action === "reject") {
      await prisma.restaurantSeller.update({
        where: { id },
        data: { isApproved: false, status: "REJECTED", adminFeedback: feedback }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Restaurant status update error:", error)
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}
