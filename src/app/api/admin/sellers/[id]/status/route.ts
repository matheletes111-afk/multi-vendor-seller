import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { validateProductOrServiceSellerApproval } from "@/lib/seller-approval-validation"
import { sendSellerApprovalEmail } from "@/lib/email"

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

        const seller = await prisma.seller.findUnique({
            where: { id },
            include: {
                user: true,
                store: true,
                businessInfo: true,
                kyc: true,
                bankDetails: true,
                selectedCategories: true,
                selectedServiceCategories: true,
                agreement: true,
            }
        })
        if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

        let updateData: any = { adminFeedback: feedback || null }

        if (action === "approve") {
            const validation = validateProductOrServiceSellerApproval(seller)
            if (!validation.canApprove) {
                return NextResponse.json(
                    {
                        error: `Cannot approve seller: Onboarding is incomplete. ${validation.missingItems.join(". ")}`,
                        missingItems: validation.missingItems,
                    },
                    { status: 400 }
                )
            }
            updateData.isApproved = true
            updateData.onboardingCompleted = true
            updateData.status = "APPROVED"
            updateData.isSuspended = false
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

        if (action === "approve" && seller.user?.email) {
            try {
                await sendSellerApprovalEmail({
                    to: seller.user.email,
                    name: seller.user.name ?? "Seller",
                })
            } catch (emailErr) {
                console.error("Failed to send seller approval email:", emailErr)
            }
        }

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Seller status update error:", error)
        return NextResponse.json({ error: "Failed to update seller status" }, { status: 500 })
    }
}
