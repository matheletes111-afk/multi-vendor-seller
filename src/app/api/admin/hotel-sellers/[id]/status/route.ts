import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { validateHotelSellerApproval } from "@/lib/seller-approval-validation"
import { sendSellerApprovalEmail } from "@/lib/email"

/** 
 * POST /api/admin/hotel-sellers/[id]/status
 * Handles approval, suspension, and rejection of hotel sellers.
 */
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

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { id },
      include: {
        user: true,
        businessInfo: true,
        kyc: true,
        bankDetails: true,
        agreement: true,
      }
    })
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 })
    }

    let updateData: any = { adminFeedback: feedback || null }

    if (action === "approve") {
      const validation = validateHotelSellerApproval(seller)
      if (!validation.canApprove) {
        return NextResponse.json(
          {
            error: `Cannot approve hotel seller: Onboarding is incomplete. ${validation.missingItems.join(". ")}`,
            missingItems: validation.missingItems,
          },
          { status: 400 }
        )
      }
      updateData.isApproved = true
      updateData.status = "APPROVED"
      updateData.onboardingCompleted = true
      updateData.isSuspended = false
    } else if (action === "suspend") {
      updateData.isSuspended = true
    } else if (action === "unsuspend") {
      updateData.isSuspended = false
    } else if (action === "reject") {
      updateData.isApproved = false
      updateData.status = "REJECTED"
      updateData.adminFeedback = feedback
    } else if (action === "correction") {
      updateData.isApproved = false
      updateData.status = "CORRECTION_NEEDED"
      updateData.adminFeedback = feedback
    }

    const updatedSeller = await prisma.hotelSeller.update({
      where: { id },
      data: updateData
    })

    if (action === "approve" && seller.user?.email) {
      try {
        await sendSellerApprovalEmail({
          to: seller.user.email,
          name: seller.user.name ?? "Hotel Partner",
        })
      } catch (emailErr) {
        console.error("Failed to send hotel seller approval email:", emailErr)
      }
    }

    return NextResponse.json({ success: true, seller: updatedSeller })
  } catch (error: any) {
    console.error("Hotel status update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 })
  }
}
