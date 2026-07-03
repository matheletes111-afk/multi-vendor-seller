import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET: Fetch restaurant detail and its menu items for mobile
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: "Restaurant ID is required" }, { status: 400 })
    }

    const restaurant = await prisma.restaurantSeller.findFirst({
      where: { id, isApproved: true, isSuspended: false },
      include: {
        businessInfo: true,
        user: {
          select: {
            name: true,
            image: true,
            email: true
          }
        },
        foods: {
          where: { isDeleted: false, isActive: true },
          include: {
            reviews: {
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 })
    }

    let cuisines: string[] = []
    if (restaurant.primaryCuisine) {
      try {
        cuisines = typeof restaurant.primaryCuisine === "string"
          ? JSON.parse(restaurant.primaryCuisine)
          : (restaurant.primaryCuisine as string[])
      } catch {
        cuisines = []
      }
    }

    const formattedFoods = restaurant.foods.map(f => {
      const totalReviews = f.reviews.length
      const averageRating = totalReviews > 0
        ? parseFloat((f.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0

      let firstImage: string | null = null
      if (Array.isArray(f.images) && f.images.length > 0) {
        firstImage = f.images[0] as string
      } else if (f.images && typeof f.images === 'string') {
        try {
          const parsed = JSON.parse(f.images)
          if (Array.isArray(parsed) && parsed.length > 0) {
            firstImage = parsed[0]
          }
        } catch {}
      }

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        price: f.price,
        image: firstImage,
        category: f.category,
        isVeg: f.isVeg,
        averageRating,
        totalReviews,
        reviews: f.reviews.map(r => ({
          id: r.id,
          userName: r.user.name || "Anonymous",
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt
        }))
      }
    })

    let totalRatingsSum = 0
    let totalReviewsCount = 0
    formattedFoods.forEach(f => {
      totalRatingsSum += f.reviews.reduce((acc, r) => acc + r.rating, 0)
      totalReviewsCount += f.totalReviews
    })
    const averageRating = totalReviewsCount > 0
      ? parseFloat((totalRatingsSum / totalReviewsCount).toFixed(1))
      : 0

    return NextResponse.json({
      success: true,
      data: {
        id: restaurant.id,
        businessName: restaurant.businessInfo?.businessName || restaurant.user.name || "Restaurant",
        cuisines,
        logo: restaurant.logo || null,
        banner: restaurant.banner || null,
        mainPhoto: restaurant.mainPhoto || null,
        street: restaurant.businessInfo?.street || "",
        city: restaurant.businessInfo?.city || "",
        state: restaurant.businessInfo?.state || "",
        landmark: restaurant.businessInfo?.landmark || "",
        averageRating,
        totalReviews: totalReviewsCount,
        foods: formattedFoods
      }
    })
  } catch (error) {
    console.error("Mobile restaurant details GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
