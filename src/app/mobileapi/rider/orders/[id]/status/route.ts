import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"
import { handleRiderStatusUpdate } from "@/lib/delivery-dispatch"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { DeliveryAssignmentStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { status, otp, proofImage, cancellationReason } = body

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 })
    }

    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: authResult.rider.id,
        OR: [{ id }, { orderId: id }],
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found for this order" },
        { status: 404 }
      )
    }

    let finalProofImage = proofImage || null
    if (proofImage && typeof proofImage === "string" && proofImage.startsWith("data:image/")) {
      try {
        const matches = proofImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const mimeType = matches[1]
          const buffer = Buffer.from(matches[2], "base64")
          const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg"
          finalProofImage = await uploadPublicFile({
            folder: "delivery-proofs",
            ext,
            contentType: mimeType,
            buffer,
            prefix: `proof-${id.slice(0, 8)}`,
          })
        }
      } catch (uploadErr) {
        console.error("Proof image upload error:", uploadErr)
      }
    }

    const result = await handleRiderStatusUpdate(
      assignment.id,
      authResult.rider.id,
      status as DeliveryAssignmentStatus,
      { otp, proofImage: finalProofImage, cancellationReason }
    )

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Delivery status updated to ${status}`,
      data: result.assignment,
    })
  } catch (error: any) {
    console.error("[Mobile API] Update delivery status error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update delivery status" },
      { status: 500 }
    )
  }
}
