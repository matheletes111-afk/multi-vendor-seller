import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = "force-dynamic"

// GET: List restaurant seller's food items that have reviews, with averages via mobile api
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const foodItems = await prisma.foodItem.findMany({
      where: {
        restaurantSellerId: seller.id,
        reviews: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        images: true,
        category: true,
        reviews: {
          select: {
            rating: true,
            createdAt: true
          }
        }
      }
    })

    const formatted = foodItems.map(item => {
      const reviewCount = item.reviews.length
      const avgRating = reviewCount > 0
        ? (item.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
        : "0.0"
      const latestReviewAt = reviewCount > 0
        ? new Date(Math.max(...item.reviews.map(r => r.createdAt.getTime()))).toISOString()
        : null

      let imageUrl: string | null = null
      if (Array.isArray(item.images) && item.images.length > 0) {
        imageUrl = item.images[0] as string
      } else if (typeof item.images === 'string') {
        try {
          const parsed = JSON.parse(item.images)
          if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
        } catch {}
      }

      return {
        foodItemId: item.id,
        foodItemName: item.name,
        foodItemImage: imageUrl,
        foodItemCategory: item.category,
        avgRating,
        reviewCount,
        latestReviewAt
      }
    })

    return NextResponse.json({ success: true, data: formatted })
  } catch (error: any) {
    console.error("Mobile list restaurant reviews error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
