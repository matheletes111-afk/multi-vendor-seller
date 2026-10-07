import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractFoodImages, shuffleArray } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

    if (category && category !== "ALL") {
      where.category = { equals: category, mode: "insensitive" }
    }

    if (isVegRaw !== null && isVegRaw !== undefined && isVegRaw !== "ALL") {
      where.isVeg = isVegRaw === "true" || isVegRaw === "1"
    }

    // Price range is applied on the selling price (price - discount) after the query
    const minPrice = minPriceRaw ? parseFloat(minPriceRaw) : NaN
    const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : NaN

    if (restaurantSellerId && restaurantSellerId !== "ALL") {
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

    const mappedFoods = foods.map(f => {
      const totalReviews = f.reviews.length
      const averageRating = totalReviews > 0 
        ? parseFloat((f.reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0

      const { reviews, ...restFood } = f
      const extractedImages = extractFoodImages(f.images)
      const firstImage = extractedImages[0] || null
      const sellingPrice = Math.max(0, f.price - (f.discount || 0))

      return {
        ...restFood,
        discount: f.discount || 0,
        sellingPrice,
        images: extractedImages,
        image: firstImage,
        averageRating,
        totalReviews,
        restaurantName: f.restaurantSeller.businessInfo?.businessName || f.restaurantSeller.user.name || "Restaurant"
      }
    })

    const formattedFoods = mappedFoods.filter(f =>
      (isNaN(minPrice) || f.sellingPrice >= minPrice) &&
      (isNaN(maxPrice) || f.sellingPrice <= maxPrice)
    )

    let result = formattedFoods
    if (ratingRaw && ratingRaw !== "ALL") {
      const minRating = parseFloat(ratingRaw)
      if (!isNaN(minRating)) {
        result = formattedFoods.filter(f => f.averageRating >= minRating)
      }
    }

    // Fetch unique active categories dynamically to keep sidebar options complete
    const allActiveCategories = await prisma.foodItem.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        restaurantSeller: {
          isApproved: true,
          isSuspended: false
        }
      },
      select: {
        category: true
      }
    })
    const uniqueCategories = Array.from(new Set(allActiveCategories.map(c => c.category)))

    const randomizedResult = shuffleArray(result)

    return NextResponse.json(
      { success: true, data: randomizedResult, categories: uniqueCategories },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Web get customer foods error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
