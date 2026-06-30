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
    const { rating, comment, imageUrls } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

    // Check if food item exists
    const food = await prisma.foodItem.findUnique({
      where: { id: foodItemId }
    })
    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    // Verify if customer has purchased this food item
    const hasBought = await prisma.foodOrder.findFirst({
      where: {
        customerId: session.user.id,
        status: "DELIVERED",
        items: {
          some: {
            foodItemId
          }
        }
      }
    })
    if (!hasBought) {
      return NextResponse.json({ success: false, error: "You can only review food items you have purchased and received." }, { status: 403 })
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
        comment: comment || null,
        images: finalImages
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
    const { rating, comment, imageUrls } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

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
        comment: comment !== undefined ? comment : existingReview.comment,
        images: imageUrls !== undefined ? finalImages : existingReview.images as any
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Web update food review error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
