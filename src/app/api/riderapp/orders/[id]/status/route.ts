import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleRiderStatusUpdate } from "@/lib/delivery-dispatch"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { DeliveryAssignmentStatus } from "@prisma/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, otp, proofImage, cancellationReason } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
    }

    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: rider.id,
        OR: [{ id }, { orderId: id }],
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found for this order" },
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
      rider.id,
      status as DeliveryAssignmentStatus,
      { otp, proofImage: finalProofImage, cancellationReason }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Delivery status updated to ${status}`,
      assignment: result.assignment,
    })
  } catch (error: any) {
    console.error("[API] Update delivery status error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to update delivery status" },
      { status: 500 }
    )
  }
}
