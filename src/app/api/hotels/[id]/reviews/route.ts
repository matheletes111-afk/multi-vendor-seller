import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    const { id: hotelId } = await params

    // Verify hotel exists
    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, isDeleted: false }
    })
    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
    }

    // Verify booking
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
        { success: false, error: "Review already submitted. Use PUT to edit." },
        { status: 409 }
      )
    }

    const { rating, comment } = await request.json()
    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return NextResponse.json({ success: false, error: "Rating must be an integer 1-5" }, { status: 400 })
    }

    const newReview = await prisma.hotelReview.create({
      data: {
        userId,
        hotelId,
        rating: numRating,
        comment: comment ? String(comment).trim().slice(0, 1000) : null
      }
    })

    return NextResponse.json({ success: true, data: { id: newReview.id } }, { status: 201 })
  } catch (error) {
    console.error("Web Hotel Review POST Error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    const { id: hotelId } = await params

    const existingReview = await prisma.hotelReview.findFirst({
      where: { userId, hotelId }
    })
    if (!existingReview) {
      return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 })
    }

    const { rating, comment } = await request.json()
    const numRating = Number(rating)
    if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      return NextResponse.json({ success: false, error: "Rating must be an integer 1-5" }, { status: 400 })
    }

    const updated = await prisma.hotelReview.update({
      where: { id: existingReview.id },
      data: {
        rating: numRating,
        comment: comment ? String(comment).trim().slice(0, 1000) : null
      }
    })

    return NextResponse.json({ success: true, data: { id: updated.id } })
  } catch (error) {
    console.error("Web Hotel Review PUT Error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
