import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { extractFoodImages } from "@/lib/utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.id || null

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

    let userHasPurchased = false
    let userReview: any = null

    if (userId) {
      const order = await prisma.foodOrder.findFirst({
        where: {
          customerId: userId,
          items: {
            some: {
              foodItemId: id
            }
          }
        }
      })
      userHasPurchased = Boolean(order)

      const existingRev = food.reviews.find(r => r.userId === userId)
      if (existingRev) {
        userReview = {
          id: existingRev.id,
          rating: existingRev.rating,
          comment: existingRev.comment,
          images: existingRev.images,
          createdAt: existingRev.createdAt
        }
      }
    }

    const reviewCount = food.reviews.length
    const totalRating = food.reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : 0

    const { reviews, ...restFood } = food
    const extractedImages = extractFoodImages(food.images)
    const firstImage = extractedImages[0] || null

    const foodData = {
      ...restFood,
      images: extractedImages,
      image: firstImage,
      averageRating,
      totalReviews: reviewCount,
      restaurantName: food.restaurantSeller.businessInfo?.businessName || food.restaurantSeller.user.name || "Restaurant",
      userHasPurchased,
      userReview,
      reviews: reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.name || "Customer",
        rating: r.rating,
        comment: r.comment,
        images: Array.isArray(r.images) ? r.images : [],
        createdAt: r.createdAt
      }))
    }

    return NextResponse.json({ success: true, data: foodData })
  } catch (error) {
    console.error("Web get customer food item details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
