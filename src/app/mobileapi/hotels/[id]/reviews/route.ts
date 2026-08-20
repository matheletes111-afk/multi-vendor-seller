import { NextRequest, NextResponse } from "next/server"
import { POST as postHotelReview } from "@/app/mobileapi/customer/hotels/[id]/reviews/route"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/hotels/:id/reviews
 * Fetch public reviews and ratings for a hotel.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hotelId } = await props.params

    const [hotel, reviews, ratingAgg, ratingGroups] = await Promise.all([
      prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { id: true, name: true, starRating: true }
      }),
      prisma.hotelReview.findMany({
        where: { hotelId },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, image: true } }
        }
      }),
      prisma.hotelReview.aggregate({
        where: { hotelId },
        _avg: { rating: true },
        _count: { rating: true }
      }),
      prisma.hotelReview.groupBy({
        by: ["rating"],
        where: { hotelId },
        _count: { rating: true }
      })
    ])

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
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
        id: hotel.id,
        name: hotel.name,
        starRating: hotel.starRating ?? 0,
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
    console.error("Hotel reviews GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/hotels/:id/reviews
 * Submit a customer hotel review.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return postHotelReview(request, props)
}
