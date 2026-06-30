import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// GET: List restaurant seller's food items that have reviews, with averages
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
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
  } catch (error) {
    console.error("Web restaurant seller get reviews error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
