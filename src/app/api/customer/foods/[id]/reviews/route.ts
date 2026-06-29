import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: Add a new food review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id: foodItemId } = await params
    const body = await request.json()
    const { rating, comment } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    // Check if food item exists
    const food = await prisma.foodItem.findUnique({
      where: { id: foodItemId }
    })
    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    // Check if user already reviewed this food item
    const existingReview = await prisma.foodReview.findFirst({
      where: {
        userId: session.user.id,
        foodItemId
      }
    })
    if (existingReview) {
      return NextResponse.json({ success: false, error: "You have already reviewed this item. Use PUT to edit it." }, { status: 400 })
    }

    const review = await prisma.foodReview.create({
      data: {
        userId: session.user.id,
        foodItemId,
        rating: parseInt(String(rating)),
        comment: comment || null
      }
    })

    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    console.error("Web add food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// PUT: Edit an existing food review
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
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
        userId: session.user.id,
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
    console.error("Web update food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
