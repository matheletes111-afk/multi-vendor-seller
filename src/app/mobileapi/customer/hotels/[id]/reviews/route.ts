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

// POST: Add a new review for a hotel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }

    const { id: hotelId } = await params

    // Verify hotel exists
    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, isDeleted: false }
    })
    if (!hotel) {
      return NextResponse.json(
        { success: false, error: "Hotel not found" },
        { status: 404 }
      )
    }

    // Verify if customer has booked this hotel
    const booking = await prisma.hotelBooking.findFirst({
      where: {
        userId,
        hotelId,
        status: "CONFIRMED"
      }
    })
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "You can only review hotels you have booked." },
        { status: 400 }
      )
    }

    // Check if review already exists
    const existingReview = await prisma.hotelReview.findFirst({
      where: { userId, hotelId }
    })
    if (existingReview) {
      return NextResponse.json(
        { success: false, error: "Review already submitted. Use PUT to edit your review." },
        { status: 409 }
      )
    }

    const body = await request.json()
    const { rating, comment, imageUrls } = body

    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      )
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

    const safeComment = comment ? String(comment).trim().slice(0, 1000) : null

    const newReview = await prisma.hotelReview.create({
      data: {
        userId,
        hotelId,
        rating: numRating,
        comment: safeComment,
        images: finalImages
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Review submitted successfully",
        data: { id: newReview.id }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Hotel Review POST Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT: Edit an existing review for a hotel
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }

    const { id: hotelId } = await params

    const existingReview = await prisma.hotelReview.findFirst({
      where: { userId, hotelId }
    })
    if (!existingReview) {
      return NextResponse.json(
        { success: false, error: "Review not found." },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { rating, comment, imageUrls } = body

    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return NextResponse.json(
        { success: false, error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      )
    }

    const finalImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      : []

    const safeComment = comment !== undefined
      ? (comment === null ? null : String(comment).trim().slice(0, 1000))
      : existingReview.comment

    const updatedReview = await prisma.hotelReview.update({
      where: { id: existingReview.id },
      data: {
        rating: numRating,
        comment: safeComment,
        images: imageUrls !== undefined ? finalImages : existingReview.images as any
      }
    })

    return NextResponse.json({
      success: true,
      message: "Review updated successfully",
      data: { id: updatedReview.id }
    })
  } catch (error: any) {
    console.error("Hotel Review PUT Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
