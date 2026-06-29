import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const food = await prisma.foodItem.findFirst({
      where: {
        id,
        isDeleted: false,
        isActive: true,
        restaurantSeller: {
          isApproved: true,
          isSuspended: false
        }
      },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        },
        restaurantSeller: {
          include: {
            businessInfo: {
              select: {
                businessName: true
              }
            },
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    const reviewCount = food.reviews.length
    const totalRating = food.reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : 0

    const { reviews, ...restFood } = food
    let firstImage: string | null = null
    if (Array.isArray(food.images) && food.images.length > 0) {
      firstImage = food.images[0] as string
    } else if (food.images && typeof food.images === 'string') {
      try {
        const parsed = JSON.parse(food.images)
        if (Array.isArray(parsed) && parsed.length > 0) {
          firstImage = parsed[0]
        }
      } catch {}
    }
    const foodData = {
      ...restFood,
      image: firstImage,
      averageRating,
      totalReviews: reviewCount,
      restaurantName: food.restaurantSeller.businessInfo?.businessName || food.restaurantSeller.user.name || "Restaurant",
      reviews: reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name || "Customer",
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt
      }))
    }

    return NextResponse.json({ success: true, data: foodData })
  } catch (error) {
    console.error("Web get customer food item details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
