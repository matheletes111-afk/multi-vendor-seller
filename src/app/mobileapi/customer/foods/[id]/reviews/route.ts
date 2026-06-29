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
    const { rating, comment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

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
        comment: comment || null
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
    const { rating, comment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

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
        comment: comment !== undefined ? comment : existingReview.comment
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Mobile update food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
