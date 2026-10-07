import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET: Browse & search foods (Guest Accessible)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const isVegRaw = searchParams.get("isVeg")
    const minPriceRaw = searchParams.get("minPrice")
    const maxPriceRaw = searchParams.get("maxPrice")
    const ratingRaw = searchParams.get("rating")
    const restaurantSellerId = searchParams.get("restaurantSellerId")
    const q = searchParams.get("q")

    const where: any = {
      isDeleted: false,
      isActive: true,
      restaurantSeller: {
        isApproved: true,
        isSuspended: false
      }
    }

    if (category) {
      where.category = { equals: category, mode: "insensitive" }
    }

    if (isVegRaw !== null && isVegRaw !== undefined) {
      where.isVeg = isVegRaw === "true" || isVegRaw === "1"
    }

    // Price range is applied on the selling price (price - discount) after the query
    const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : NaN
    const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : NaN

    if (restaurantSellerId) {
      where.restaurantSellerId = restaurantSellerId
    }

    if (q) {
      const numQ = Number(q)
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { restaurantSeller: { businessInfo: { businessName: { contains: q, mode: "insensitive" } } } },
        ...(!isNaN(numQ) && numQ > 0 ? [{ price: { equals: numQ } }] : []),
      ]
    }

    const foods = await prisma.foodItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        reviews: {
          select: {
            rating: true
          }
        },
        restaurantSeller: {
          include: {
            businessInfo: {
              select: {
                businessName: true,
                street: true,
                city: true
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

    const mappedFoods = foods.map(f => {
      const totalReviews = f.reviews.length
      const averageRating = totalReviews > 0 
        ? parseFloat((f.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0

      const { reviews, restaurantSeller, ...restFood } = f
      let firstImage: string | null = null
      if (Array.isArray(f.images) && f.images.length > 0) {
        firstImage = f.images[0] as string
      }
      const sellingPrice = Math.max(0, f.price - (f.discount || 0))
      return {
        ...restFood,
        discount: f.discount || 0,
        sellingPrice,
        selling_price: sellingPrice,
        food_id: f.id,
        image: firstImage,
        image_url: firstImage,
        rating: averageRating,
        averageRating,
        review_count: totalReviews,
        reviewCount: totalReviews,
        totalReviews,
        reviewsCount: totalReviews,
        restaurantId: restaurantSeller.id,
        restaurant_id: restaurantSeller.id,
        restaurantName: restaurantSeller.businessInfo?.businessName || restaurantSeller.user.name || "Restaurant",
        restaurantCity: restaurantSeller.businessInfo?.city || ""
      }
    })

    const formattedFoods = mappedFoods.filter(
      f =>
        (isNaN(minPrice) || f.sellingPrice >= minPrice) &&
        (isNaN(maxPrice) || f.sellingPrice <= maxPrice)
    )

    // Filter by rating post-query if requested
    let result = formattedFoods
    if (ratingRaw) {
      const minRating = parseFloat(ratingRaw)
      if (!isNaN(minRating)) {
        result = formattedFoods.filter(f => f.averageRating >= minRating)
      }
    }

    const finalResult = q ? result : shuffleArray(result)

    return NextResponse.json(
      {
        success: true,
        data: finalResult,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Mobile public list foods error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
