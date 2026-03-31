import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"
import { getSellerSubscription, canReceiveReviews } from "@/lib/subscriptions"

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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const { orderItemId, rating, comment, images } = body

    if (!orderItemId || typeof orderItemId !== "string") {
      return NextResponse.json(
        { success: false, error: "orderItemId is required and must be a string" },
        { status: 400 }
      )
    }

    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      )
    }

    const safeComment = typeof comment === "string" ? comment.trim().slice(0, 2000) : ""
    
    // Validate images array
    const safeImages = Array.isArray(images)
      ? images.filter((img): img is string => typeof img === "string" && /^https?:\/\//.test(img)).slice(0, 5)
      : []

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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const { orderItemId, rating, comment, images } = body

    if (!orderItemId || typeof orderItemId !== "string") {
      return NextResponse.json(
        { success: false, error: "orderItemId is required and must be a string" },
        { status: 400 }
      )
    }

    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      )
    }

    const safeComment = typeof comment === "string" ? comment.trim().slice(0, 2000) : ""
    
    // Validate images array
    const safeImages = Array.isArray(images)
      ? images.filter((img): img is string => typeof img === "string" && /^https?:\/\//.test(img)).slice(0, 5)
      : []

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

    const updated = await prisma.review.update({
      where: { orderItemId: orderItem.id },
      data: {
        rating: numRating,
        comment: safeComment || null,
        images: safeImages,
        isVerified: true
      },
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
