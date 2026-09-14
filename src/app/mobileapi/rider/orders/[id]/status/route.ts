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

  const { id } = await params

  try {
    let status: string = ""
    let otp: string | undefined
    let proofImage: string | undefined
    let rawPickupPhotos: any[] = []
    let cancellationReason: string | undefined

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      status = (formData.get("status") as string) || ""
      otp = (formData.get("otp") as string) || undefined
      cancellationReason = (formData.get("cancellationReason") as string) || (formData.get("cancellation_reason") as string) || undefined

      // Support binary File or string for proofImage in multipart
      const rawProof = formData.get("proofImage") || formData.get("proof_image")
      if (rawProof instanceof File) {
        try {
          const arrayBuffer = await rawProof.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const ext = rawProof.name ? `.${rawProof.name.split(".").pop()}` : ".jpg"
          const uploadedUrl = await uploadPublicFile({
            folder: "review-images/delivery-proofs",
            ext,
            contentType: rawProof.type || "image/jpeg",
            buffer,
            prefix: `proof-${id.slice(0, 8)}`,
          })
          if (uploadedUrl) proofImage = uploadedUrl
        } catch (err) {
          console.error("Failed to upload multipart proofImage file:", err)
        }
      } else if (typeof rawProof === "string" && rawProof.trim()) {
        proofImage = rawProof.trim()
      }

      // Collect multiple pickup photo files or URLs from form data - support common variations
      const photoFiles = [
        ...formData.getAll("pickupPhotos"),
        ...formData.getAll("pickupPhotos[]"),
        ...formData.getAll("pickup_photos"),
        ...formData.getAll("pickup_photos[]"),
        ...formData.getAll("pickupPhoto"),
        ...formData.getAll("pickup_photo"),
      ]
      for (const item of photoFiles) {
        if (item instanceof File) {
          try {
            const arrayBuffer = await item.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const ext = item.name ? `.${item.name.split(".").pop()}` : ".jpg"
            const url = await uploadPublicFile({
              folder: "review-images/pickup-proofs",
              ext,
              contentType: item.type || "image/jpeg",
              buffer,
              prefix: `pickup-${id.slice(0, 8)}`,
            })
            if (url) rawPickupPhotos.push(url)
          } catch (err) {
            console.error("Failed to upload multipart pickup photo:", err)
          }
        } else if (typeof item === "string" && item.trim()) {
          rawPickupPhotos.push(item.trim())
        }
      }
    } else {
      const body = await request.json()
      status = body.status
      otp = body.otp
      proofImage = body.proofImage || body.proof_image
      cancellationReason = body.cancellationReason || body.cancellation_reason

      const candidatePhotos =
        body.pickupPhotos ??
        body.pickup_photos ??
        body.pickupImages ??
        body.pickupPhoto ??
        body.pickup_photo
      if (Array.isArray(candidatePhotos)) {
        rawPickupPhotos = candidatePhotos
      } else if (typeof candidatePhotos === "string" && candidatePhotos.trim()) {
        rawPickupPhotos = [candidatePhotos.trim()]
      }
    }

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
    if (proofImage && typeof proofImage === "string" && (proofImage.startsWith("data:image/") || (!proofImage.startsWith("http") && !proofImage.startsWith("/") && proofImage.length > 100))) {
      const normalizedProof = proofImage.startsWith("data:image/")
        ? proofImage
        : `data:image/jpeg;base64,${proofImage}`
      try {
        const matches = normalizedProof.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const mimeType = matches[1]
          const buffer = Buffer.from(matches[2], "base64")
          const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg"
          finalProofImage = await uploadPublicFile({
            folder: "review-images/delivery-proofs",
            ext,
            contentType: mimeType,
            buffer,
            prefix: `proof-${id.slice(0, 8)}`,
          })
        }
      } catch (uploadErr) {
        console.error("Proof image upload error:", uploadErr)
        finalProofImage = normalizedProof
      }
    }

    // Process multiple pickup photos (convert base64 to public URLs with resilient fallback)
    const finalPickupPhotos: string[] = []
    if (Array.isArray(rawPickupPhotos) && rawPickupPhotos.length > 0) {
      for (let i = 0; i < rawPickupPhotos.length; i++) {
        const photo = rawPickupPhotos[i]
        if (typeof photo === "string" && (photo.startsWith("data:image/") || (!photo.startsWith("http") && !photo.startsWith("/") && photo.length > 100))) {
          const normalizedPhoto = photo.startsWith("data:image/")
            ? photo
            : `data:image/jpeg;base64,${photo}`
          try {
            const matches = normalizedPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
            if (matches && matches.length === 3) {
              const mimeType = matches[1]
              const buffer = Buffer.from(matches[2], "base64")
              const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg"
              const url = await uploadPublicFile({
                folder: "review-images/pickup-proofs",
                ext,
                contentType: mimeType,
                buffer,
                prefix: `pickup-${id.slice(0, 8)}-${i + 1}`,
              })
              if (url) finalPickupPhotos.push(url)
            }
          } catch (err) {
            console.error(`Error uploading base64 pickup photo #${i}:`, err)
            // Fallback: preserve photo data so it is not lost even if storage upload encounters an issue
            finalPickupPhotos.push(normalizedPhoto)
          }
        } else if (typeof photo === "string" && (photo.startsWith("http") || photo.startsWith("/"))) {
          finalPickupPhotos.push(photo)
        }
      }
    }

    const result = await handleRiderStatusUpdate(
      assignment.id,
      authResult.rider.id,
      status as DeliveryAssignmentStatus,
      {
        otp,
        proofImage: finalProofImage || undefined,
        pickupPhotos: finalPickupPhotos.length > 0 ? finalPickupPhotos : undefined,
        cancellationReason,
      }
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
