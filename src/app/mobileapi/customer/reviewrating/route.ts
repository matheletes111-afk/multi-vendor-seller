import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { getSellerSubscription, canReceiveReviews } from "@/lib/subscriptions"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export const dynamic = "force-dynamic"

function getCustomerId(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER") return null
  return payload.userId
}

interface SuccessResponse {
  success: true
  message: string
  data: { reviewId: string }
}

interface ErrorResponse {
  success: false
  error: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400 }
      )
    }

    const orderItemId = formData.get("orderItemId") as string
    const rating = formData.get("rating")
    const comment = formData.get("comment") as string
    const imageData = formData.getAll("images")
    const imageFiles = imageData.filter((f): f is File => f instanceof File)
    const existingUrls = imageData.filter((f): f is string => typeof f === "string" && /^https?:\/\//.test(f)).slice(0, 5)

    if (!orderItemId || typeof orderItemId !== "string") {
      return NextResponse.json(
        { success: false, error: "orderItemId is required and must be a string" },
        { status: 400 }
      )
    }

    const numRating = Number(rating)
    if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      )
    }

    const safeComment = comment ? comment.trim().slice(0, 2000) : ""
    
    // Process images
    if (imageFiles.length + existingUrls.length > 5) {
      return NextResponse.json(
        { success: false, error: "Maximum 5 images allowed" },
        { status: 400 }
      )
    }

    for (const file of imageFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 5MB limit` },
          { status: 400 }
        )
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Invalid file type for ${file.name}. Allowed: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }
    }

    const uploadedUrls: string[] = []
    for (const file of imageFiles) {
      const bytes = await file.arrayBuffer()
      const ext = path.extname(file.name) || ".jpg"
      const url = await uploadPublicFile({
        folder: "review-images",
        ext,
        contentType: file.type,
        buffer: Buffer.from(bytes),
        prefix: "review",
      })
      uploadedUrls.push(url)
    }

    const safeImages = [...existingUrls, ...uploadedUrls].slice(0, 5)

    const orderItem = await prisma.orderItem.findFirst({
      where: { 
        id: orderItemId,
        order: { customerId: userId }
      },
      include: { review: { select: { id: true } } }
    })

    if (!orderItem) {
      return NextResponse.json(
        { success: false, error: "Order item not found" },
        { status: 404 }
      )
    }
    
    if (orderItem.itemStatus !== "DELIVERED") {
      return NextResponse.json(
        { success: false, error: "Review is allowed only for delivered items" },
        { status: 400 }
      )
    }

    if (orderItem.review?.id) {
      return NextResponse.json(
        { success: false, error: "Review already submitted for this item" },
        { status: 409 }
      )
    }
    
    if (!orderItem.sellerId) {
      return NextResponse.json(
        { success: false, error: "Seller not found for this item" },
        { status: 400 }
      )
    }

    if (!orderItem.productId && !orderItem.serviceId) {
      return NextResponse.json(
        { success: false, error: "Item is not reviewable (must be a product or service)" },
        { status: 400 }
      )
    }

    const subscription = await getSellerSubscription(orderItem.sellerId)
    if (!canReceiveReviews(orderItem.sellerId, subscription)) {
      return NextResponse.json(
        { success: false, error: "Seller plan does not allow receiving reviews" },
        { status: 403 }
      )
    }

    const newReview = await prisma.review.create({
      data: {
        userId,
        orderItemId: orderItem.id,
        productId: orderItem.productId,
        serviceId: orderItem.serviceId,
        rating: numRating,
        comment: safeComment || null,
        images: safeImages,
        isVerified: true
      },
      select: { id: true }
    })

    return NextResponse.json(
      { 
        success: true, 
        message: "Review submitted successfully",
        data: { reviewId: newReview.id }
      }, 
      { status: 201 }
    )
    
  } catch (error: any) {
    console.error("Mobile API Review Create Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400 }
      )
    }

    const orderItemId = formData.get("orderItemId") as string
    const rating = formData.get("rating")
    const comment = formData.get("comment") as string
    const imageData = formData.getAll("images")
    const imageFiles = imageData.filter((f): f is File => f instanceof File)
    const existingUrls = imageData.filter((f): f is string => typeof f === "string" && /^https?:\/\//.test(f)).slice(0, 5)

    if (!orderItemId || typeof orderItemId !== "string") {
      return NextResponse.json(
        { success: false, error: "orderItemId is required and must be a string" },
        { status: 400 }
      )
    }

    const numRating = Number(rating)
    if (isNaN(numRating) || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      )
    }

    const safeComment = comment ? comment.trim().slice(0, 2000) : ""
    
    // Process images
    if (imageFiles.length + existingUrls.length > 5) {
      return NextResponse.json(
        { success: false, error: "Maximum 5 images allowed" },
        { status: 400 }
      )
    }

    for (const file of imageFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 5MB limit` },
          { status: 400 }
        )
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Invalid file type for ${file.name}. Allowed: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }
    }

    const uploadedUrls: string[] = []
    for (const file of imageFiles) {
      const bytes = await file.arrayBuffer()
      const ext = path.extname(file.name) || ".jpg"
      const url = await uploadPublicFile({
        folder: "review-images",
        ext,
        contentType: file.type,
        buffer: Buffer.from(bytes),
        prefix: "review",
      })
      uploadedUrls.push(url)
    }

    const safeImages = formData.has("images") ? [...existingUrls, ...uploadedUrls].slice(0, 5) : undefined

    const orderItem = await prisma.orderItem.findFirst({
      where: { 
        id: orderItemId,
        order: { customerId: userId }
      }
    })

    if (!orderItem) {
      return NextResponse.json(
        { success: false, error: "Order item not found" },
        { status: 404 }
      )
    }

    if (orderItem.itemStatus !== "DELIVERED") {
      return NextResponse.json(
        { success: false, error: "Review updates are allowed only for delivered items" },
        { status: 400 }
      )
    }

    const existing = await prisma.review.findUnique({
      where: { orderItemId: orderItem.id },
      select: { id: true, userId: true }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      )
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      )
    }

    const updateData: any = {
      rating: numRating,
      comment: safeComment || null,
      isVerified: true
    }
    if (safeImages !== undefined) {
      updateData.images = safeImages
    }

    const updated = await prisma.review.update({
      where: { orderItemId: orderItem.id },
      data: updateData,
      select: { id: true }
    })

    return NextResponse.json({
      success: true,
      message: "Review updated successfully",
      data: { reviewId: updated.id }
    })
  } catch (error: any) {
    console.error("Mobile API Review Update Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
