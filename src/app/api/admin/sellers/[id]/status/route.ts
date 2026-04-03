import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

/** POST to update seller onboarding status (APPROVE, REJECT, CORRECTION) */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user || !isAdmin(session.user)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const { action, feedback } = await request.json()

        const seller = await prisma.seller.findUnique({ where: { id } })
        if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

        let updateData: any = { adminFeedback: feedback || null }

        if (action === "approve") {
            updateData.isApproved = true
            updateData.onboardingCompleted = true
            updateData.status = "APPROVED"
        } else if (action === "reject") {
            updateData.isApproved = false
            updateData.isSuspended = true
            updateData.status = "REJECTED"
        } else if (action === "correction") {
            updateData.isApproved = false
            updateData.status = "CORRECTION_NEEDED"
            updateData.onboardingCompleted = false // Reset so they go back through flow or edit settings
        }

        const updated = await prisma.seller.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Seller status update error:", error)
        return NextResponse.json({ error: "Failed to update seller status" }, { status: 500 })
    }
}
