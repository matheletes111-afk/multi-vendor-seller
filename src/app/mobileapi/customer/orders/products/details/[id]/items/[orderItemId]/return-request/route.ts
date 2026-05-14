import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { prisma } from "@/lib/prisma"
import {
  validateReturnImageUrls,
  validateReturnReason,
} from "@/lib/return-request-validation"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"

export const dynamic = "force-dynamic"

/** POST /mobileapi/customer/orders/products/details/[id]/items/[orderItemId]/return-request
 * Submit a return or exchange request. CUSTOMER only.
 * Auth: Bearer token.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  try {
    const auth = getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
    }

    const { id: orderId, orderItemId } = await params

    let reasonRaw = ""
    let resolutionType: "EXCHANGE" | "REFUND" = "REFUND"
    let replacementVariantId: string | null = null
    const uploadedUrls: string[] = []

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      reasonRaw = formData.get("reason")?.toString() || ""
      resolutionType = formData.get("resolutionType")?.toString() === "EXCHANGE" ? "EXCHANGE" : "REFUND"
      replacementVariantId = formData.get("replacementVariantId")?.toString().trim() || null

      const files = formData.getAll("returnImages")

      // Validation loop
      for (const file of files) {
        if (file instanceof File) {
          if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, error: `File ${file.name} exceeds 5MB limit` }, { status: 400 })
          }
          if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, error: `Invalid file type for ${file.name}. Allowed: JPEG (jpg/jpeg), PNG, WebP, GIF` }, { status: 400 })
          }
        }
      }

      for (const file of files) {
        if (file instanceof File) {
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          const ext = path.extname(file.name) || ".jpg"
          const url = await uploadPublicFile({
            folder: "return-images",
            ext,
            contentType: file.type || "image/jpeg",
            buffer,
            prefix: "return",
          })
          uploadedUrls.push(url)
        } else if (typeof file === "string" && file.trim()) {
          uploadedUrls.push(file.trim())
        }
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as any
      reasonRaw = typeof body.reason === "string" ? body.reason : ""
      resolutionType = body.resolutionType === "EXCHANGE" ? "EXCHANGE" : "REFUND"
      replacementVariantId = typeof body.replacementVariantId === "string" ? body.replacementVariantId.trim() : null
      if (Array.isArray(body.returnImages)) {
        for (const img of body.returnImages) {
          if (typeof img === "string" && img.trim()) uploadedUrls.push(img.trim())
        }
      }
    }

    const reasonCheck = validateReturnReason(reasonRaw)
    if (!reasonCheck.ok) {
      return NextResponse.json({ success: false, error: reasonCheck.error }, { status: 400 })
    }

    const imgCheck = validateReturnImageUrls(uploadedUrls)
    if (!imgCheck.ok) {
      return NextResponse.json({ success: false, error: imgCheck.error }, { status: 400 })
    }

    const reason = reasonCheck.value
    const returnImages = imgCheck.value

    const item = await prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        orderId,
        order: { customerId: auth.userId },
        productId: { not: null },
      },
      select: {
        id: true,
        orderId: true,
        sellerId: true,
        productId: true,
        productVariantId: true,
        itemStatus: true,
        deliveredAt: true,
        quantity: true,
        returnRequest: { select: { id: true } },
        productVariant: { select: { returnType: true, returnDays: true, replacementAllowed: true } },
      },
    })

    if (!item) return NextResponse.json({ success: false, error: "Order item not found" }, { status: 404 })
    if (!item.sellerId || !item.productId) return NextResponse.json({ success: false, error: "Seller not found for this item" }, { status: 400 })
    if (item.itemStatus !== "DELIVERED") {
      return NextResponse.json({ success: false, error: "Return is allowed only for delivered items" }, { status: 400 })
    }
    if (item.productVariant?.returnType !== "RETURNABLE") {
      return NextResponse.json({ success: false, error: "This item is not returnable" }, { status: 400 })
    }

    const returnDays = item.productVariant.returnDays ?? 0
    if (returnDays <= 0) {
      return NextResponse.json({ success: false, error: "Return period is not configured for this item" }, { status: 400 })
    }

    const deliveredAt = item.deliveredAt ?? null
    if (!deliveredAt) {
      return NextResponse.json({ success: false, error: "Return is allowed only after delivered confirmation" }, { status: 400 })
    }

    const now = Date.now()
    const deadline = deliveredAt.getTime() + returnDays * 24 * 60 * 60 * 1000
    if (now > deadline) {
      return NextResponse.json({ success: false, error: "Return period has expired for this item" }, { status: 400 })
    }

    if (item.returnRequest?.id) {
      return NextResponse.json({ success: false, error: "Return already requested for this item" }, { status: 409 })
    }

    let replacementVariantIdFinal: string | null = null
    if (resolutionType === "EXCHANGE") {
      if (item.productVariant?.replacementAllowed !== true) {
        return NextResponse.json({ success: false, error: "Exchange is not enabled for this variant" }, { status: 400 })
      }
      if (!replacementVariantId) {
        return NextResponse.json({ success: false, error: "Choose a replacement variant for exchange" }, { status: 400 })
      }
      const target = await prisma.productVariant.findFirst({
        where: { id: replacementVariantId, productId: item.productId },
      })
      if (!target || target.id === item.productVariantId) {
        return NextResponse.json({ success: false, error: "Invalid replacement variant" }, { status: 400 })
      }
      if (target.stock < item.quantity) {
        return NextResponse.json({ success: false, error: "Selected variant does not have enough stock" }, { status: 400 })
      }
      replacementVariantIdFinal = target.id
    }

    const created = await prisma.returnRequest.create({
      data: {
        orderItemId: item.id,
        orderId: item.orderId,
        customerId: auth.userId,
        sellerId: item.sellerId,
        reason,
        returnImages,
        status: "REQUESTED",
        pickupStatus: "NOT_REQUESTED",
        refundStatus: "NOT_REQUESTED",
        resolutionType,
        replacementVariantId: replacementVariantIdFinal,
      },
      select: {
        id: true,
        status: true,
        pickupStatus: true,
        refundStatus: true,
        resolutionType: true,
      },
    })

    return NextResponse.json({ success: true, message: "Return request created", data: created })
  } catch (error) {
    console.error("Mobile customer return request error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
