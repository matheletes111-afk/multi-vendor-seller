import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

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

    if (minPriceRaw) {
      const minPrice = parseFloat(minPriceRaw)
      if (!isNaN(minPrice)) {
        where.price = { ...where.price, gte: minPrice }
      }
    }

    if (maxPriceRaw) {
      const maxPrice = parseFloat(maxPriceRaw)
      if (!isNaN(maxPrice)) {
        where.price = { ...where.price, lte: maxPrice }
      }
    }

    if (restaurantSellerId) {
      where.restaurantSellerId = restaurantSellerId
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
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
        }
      }
    })

    const formattedFoods = foods.map(f => {
      const totalReviews = f.reviews.length
      const averageRating = totalReviews > 0 
        ? parseFloat((f.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0

      const { reviews, ...restFood } = f
      let firstImage: string | null = null
      if (Array.isArray(f.images) && f.images.length > 0) {
        firstImage = f.images[0] as string
      }
      return {
        ...restFood,
        image: firstImage,
        averageRating,
        totalReviews
      }
    })

    // Filter by rating post-query if requested
    let result = formattedFoods
    if (ratingRaw) {
      const minRating = parseFloat(ratingRaw)
      if (!isNaN(minRating)) {
        result = formattedFoods.filter(f => f.averageRating >= minRating)
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error("Mobile public list foods error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
