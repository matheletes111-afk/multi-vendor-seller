import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const hotel = await prisma.hotel.findFirst({
      where: {
        id,
        isActive: true,
        isDeleted: false,
        hotelSeller: {
          isApproved: true,
          isSuspended: false,
        }
      },
      include: {
        rooms: {
          where: { isActive: true, isDeleted: false },
          orderBy: { price: "asc" }
        },
        sellerAds: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    })

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
    }

    const reviewCount = hotel.reviews.length
    const totalRating = hotel.reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : 0

    // Remove raw reviews relation structure and format properly
    const { reviews, ...restHotel } = hotel
    const hotelData = {
      ...restHotel,
      averageRating,
      totalReviews: reviewCount,
      reviews: reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name || "Customer",
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt
      }))
    }

    return NextResponse.json({ success: true, data: hotelData })
  } catch (error) {
    console.error("Error fetching mobile hotel details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
