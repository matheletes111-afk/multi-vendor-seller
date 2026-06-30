import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = "force-dynamic"

// GET: List hotel seller's hotels that have reviews, with averages via mobile api
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const hotels = await prisma.hotel.findMany({
      where: {
        hotelSellerId: seller.id,
        isDeleted: false,
        reviews: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        images: true,
        reviews: {
          select: {
            rating: true,
            createdAt: true
          }
        }
      }
    })

    const formatted = hotels.map(h => {
      const reviewCount = h.reviews.length
      const avgRating = reviewCount > 0
        ? (h.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
        : "0.0"
      const latestReviewAt = reviewCount > 0
        ? new Date(Math.max(...h.reviews.map(r => r.createdAt.getTime()))).toISOString()
        : null

      let imageUrl: string | null = null
      if (Array.isArray(h.images) && h.images.length > 0) {
        imageUrl = h.images[0] as string
      } else if (typeof h.images === 'string') {
        try {
          const parsed = JSON.parse(h.images)
          if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
        } catch {}
      }

      return {
        hotelId: h.id,
        hotelName: h.name,
        hotelImage: imageUrl,
        avgRating,
        reviewCount,
        latestReviewAt
      }
    })

    return NextResponse.json({ success: true, data: formatted })
  } catch (error: any) {
    console.error("Mobile hotel seller reviews list error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
