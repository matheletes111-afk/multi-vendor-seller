import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/v1/foods
 * List / browse foods with live computed database review ratings and counts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get("category")
    const restaurantSellerId = searchParams.get("restaurantSellerId")
    const isVegRaw = searchParams.get("isVeg")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
      isDeleted: false,
      restaurantSeller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    if (categoryParam && categoryParam.trim().length > 0 && categoryParam !== "ALL") {
      where.category = { equals: categoryParam.trim(), mode: "insensitive" }
    }

    if (restaurantSellerId && restaurantSellerId.trim().length > 0) {
      where.restaurantSellerId = restaurantSellerId.trim()
    }

    if (isVegRaw !== null && isVegRaw !== undefined) {
      where.isVeg = isVegRaw === "true" || isVegRaw === "1"
    }

    const [totalItems, foodItems] = await Promise.all([
      prisma.foodItem.count({ where }),
      prisma.foodItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          restaurantSeller: {
            select: {
              id: true,
              logo: true,
              businessInfo: { select: { businessName: true, city: true } },
              user: { select: { name: true } },
            },
          },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedItems = foodItems.map((fi) => {
      let imageUrl: string | null = null
      if (Array.isArray(fi.images) && fi.images.length > 0) {
        imageUrl = String(fi.images[0])
      }

      const totalRating = fi.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = fi.reviews.length > 0 ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 0.0

      const restaurantName =
        fi.restaurantSeller.businessInfo?.businessName ||
        fi.restaurantSeller.user?.name ||
        "Gourmet Restaurant"

      return {
        id: fi.id,
        food_id: fi.id,
        restaurantSellerId: fi.restaurantSeller.id,
        restaurant_seller_id: fi.restaurantSeller.id,
        title: fi.name,
        name: fi.name,
        description: fi.description || "",
        category: fi.category,
        price: fi.price,
        is_veg: fi.isVeg,
        isVeg: fi.isVeg,
        image: imageUrl,
        image_url: imageUrl,
        restaurant_name: restaurantName,
        restaurantName: restaurantName,
        restaurant_logo: fi.restaurantSeller.logo || null,
        restaurantCity: fi.restaurantSeller.businessInfo?.city || "",
        rating,
        averageRating: rating,
        review_count: fi.reviews.length,
        reviewCount: fi.reviews.length,
        totalReviews: fi.reviews.length,
        reviewsCount: fi.reviews.length,
        delivery_time: "25-35 mins",
      }
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      success: true,
      data: formattedItems,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_items: totalItems,
        has_more: page < totalPages,
      },
    })
  } catch (error) {
    console.error("Foods v1 API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
