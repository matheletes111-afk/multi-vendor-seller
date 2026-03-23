import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSellerSubscription, canReceiveReviews } from "@/lib/subscriptions"

type ReviewPayload = {
  rating?: number
  comment?: string
  imageUrls?: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, orderItemId } = await params
  let body: ReviewPayload
  try {
    body = (await request.json()) as ReviewPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 5" }, { status: 400 })
  }
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : ""
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url)).slice(0, 5)
    : []

  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.id },
    select: {
      id: true,
      items: {
        where: { id: orderItemId },
        select: {
          id: true,
          sellerId: true,
          itemStatus: true,
          productId: true,
          serviceId: true,
          review: { select: { id: true } },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  const item = order.items[0]
  if (!item) return NextResponse.json({ error: "Order item not found in this order" }, { status: 404 })
  if (!item.sellerId) return NextResponse.json({ error: "Order item seller not found" }, { status: 400 })

  const subscription = await getSellerSubscription(item.sellerId)
  if (!canReceiveReviews(item.sellerId, subscription)) {
    return NextResponse.json({ error: "Seller plan does not allow receiving reviews" }, { status: 403 })
  }
  if (item.itemStatus !== "DELIVERED") {
    return NextResponse.json({ error: "Review is allowed only for delivered items" }, { status: 400 })
  }
  if (item.review?.id) return NextResponse.json({ error: "Review already submitted for this item" }, { status: 409 })
  if (!item.productId && !item.serviceId) {
    return NextResponse.json({ error: "Item is not reviewable" }, { status: 400 })
  }

  const review = await prisma.review.create({
    data: {
      userId: session.user.id,
      orderItemId: item.id,
      productId: item.productId,
      serviceId: item.serviceId,
      rating,
      comment: comment || null,
      images: imageUrls,
      isVerified: true,
    },
    select: { id: true },
  })

  return NextResponse.json({ success: true, reviewId: review.id })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId, orderItemId } = await params

  let body: ReviewPayload
  try {
    body = (await request.json()) as ReviewPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 5" }, { status: 400 })
  }
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : ""
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url)).slice(0, 5)
    : []

  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: session.user.id },
    select: {
      id: true,
      items: {
        where: { id: orderItemId },
        select: {
          id: true,
          itemStatus: true,
        },
      },
    },
  })

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  const item = order.items[0]
  if (!item) return NextResponse.json({ error: "Order item not found in this order" }, { status: 404 })

  if (item.itemStatus !== "DELIVERED") {
    return NextResponse.json({ error: "Review updates are allowed only for delivered items" }, { status: 400 })
  }

  const existing = await prisma.review.findUnique({
    where: { orderItemId: item.id },
    select: { id: true, userId: true },
  })

  if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 })
  if (existing.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const updated = await prisma.review.update({
    where: { orderItemId: item.id },
    data: {
      rating,
      comment: comment || null,
      images: imageUrls,
      isVerified: true,
    },
    select: { id: true },
  })

  return NextResponse.json({ success: true, reviewId: updated.id })
}
