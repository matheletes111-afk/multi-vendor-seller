import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export const dynamic = "force-dynamic"

function getCustomerId(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER") return null
  return payload.userId
}

// GET: Get food reviews and breakdown
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: foodItemId } = await params

    const [food, reviews, ratingAgg, ratingGroups] = await Promise.all([
      prisma.foodItem.findUnique({
        where: { id: foodItemId },
        select: { id: true, name: true }
      }),
      prisma.foodReview.findMany({
        where: { foodItemId },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, image: true } }
        }
      }),
      prisma.foodReview.aggregate({
        where: { foodItemId },
        _avg: { rating: true },
        _count: { rating: true }
      }),
      prisma.foodReview.groupBy({
        by: ["rating"],
        where: { foodItemId },
        _count: { rating: true }
      })
    ])

    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    const breakdown: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    ratingGroups.forEach(g => {
      if (g.rating >= 1 && g.rating <= 5) {
        breakdown[String(g.rating)] = g._count.rating
      }
    })

    const reviewCount = ratingAgg._count.rating ?? 0
    const averageRating = parseFloat(Number(ratingAgg._avg.rating ?? 0).toFixed(1))

    return NextResponse.json({
      success: true,
      data: {
        id: food.id,
        name: food.name,
        averageRating,
        totalReviews: reviewCount,
        reviewCount,
        reviewsCount: reviewCount,
        breakdown,
        reviews: reviews.map(r => ({
          id: r.id,
          userId: r.userId,
          userName: r.user?.name || "Customer",
          userAvatar: r.user?.image || null,
          rating: r.rating,
          comment: r.comment,
          images: Array.isArray(r.images) ? r.images : [],
          createdAt: r.createdAt.toISOString()
        }))
      }
    })
  } catch (error) {
    console.error("Food reviews GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST: Add a new food review via mobile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: foodItemId } = await params
    const body = await request.json()
    const { rating, comment, imageUrls } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

    const food = await prisma.foodItem.findUnique({
      where: { id: foodItemId }
    })
    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    const existingReview = await prisma.foodReview.findFirst({
      where: {
        userId,
        foodItemId
      }
    })
    if (existingReview) {
      return NextResponse.json({ success: false, error: "You have already reviewed this item. Use PUT to edit it." }, { status: 400 })
    }

    const review = await prisma.foodReview.create({
      data: {
        userId,
        foodItemId,
        rating: parseInt(String(rating)),
        comment: comment || null,
        images: finalImages
      }
    })

    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    console.error("Mobile add food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT: Edit an existing food review via mobile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: foodItemId } = await params
    const body = await request.json()
    const { rating, comment, imageUrls } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

    const existingReview = await prisma.foodReview.findFirst({
      where: {
        userId,
        foodItemId
      }
    })
    if (!existingReview) {
      return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
    }

    const updated = await prisma.foodReview.update({
      where: { id: existingReview.id },
      data: {
        rating: parseInt(String(rating)),
        comment: comment !== undefined ? comment : existingReview.comment,
        images: imageUrls !== undefined ? finalImages : existingReview.images as any
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Mobile update food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
