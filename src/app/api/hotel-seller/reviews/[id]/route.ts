import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET: List detailed guest reviews for a specific hotel stay
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_HOTEL") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { id: hotelId } = await params
    if (!hotelId) {
      return NextResponse.json({ success: false, error: "Hotel ID is required" }, { status: 400 })
    }

    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, hotelSellerId: seller.id, isDeleted: false },
      select: { id: true, name: true, images: true }
    })
    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found or unauthorized" }, { status: 404 })
    }

    const reviews = await prisma.hotelReview.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    const reviewCount = reviews.length
    const avgRating = reviewCount > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
      : "0.0"

    let imageUrl: string | null = null
    if (Array.isArray(hotel.images) && hotel.images.length > 0) {
      imageUrl = hotel.images[0] as string
    } else if (typeof hotel.images === 'string') {
      try {
        const parsed = JSON.parse(hotel.images)
        if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
      } catch {}
    }

    const formattedReviews = reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      images: r.images,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name || "Customer",
      userEmail: r.user.email
    }))

    return NextResponse.json({
      success: true,
      data: {
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelImage: imageUrl,
        avgRating,
        reviewCount,
        reviews: formattedReviews
      }
    })
  } catch (error) {
    console.error("Web hotel seller review details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
