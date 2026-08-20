import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET: Get food details and customer reviews (Guest Accessible)
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
        sellerAds: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
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

    const breakdown: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    food.reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[String(r.rating)] = (breakdown[String(r.rating)] || 0) + 1
      }
    })

    const { reviews, ...restFood } = food
    let firstImage: string | null = null
    if (Array.isArray(food.images) && food.images.length > 0) {
      firstImage = food.images[0] as string
    }
    const foodData = {
      ...restFood,
      image: firstImage,
      averageRating,
      totalReviews: reviewCount,
      reviewCount,
      reviewsCount: reviewCount,
      breakdown,
      reviews: reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.name || "Customer",
        userAvatar: (r.user as any)?.image || null,
        rating: r.rating,
        comment: r.comment,
        images: Array.isArray((r as any).images) ? (r as any).images : [],
        createdAt: r.createdAt
      }))
    }

    return NextResponse.json({
      success: true,
      data: foodData
    })
  } catch (error: any) {
    console.error("Mobile public food item details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
