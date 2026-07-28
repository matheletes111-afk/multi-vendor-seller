import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

    const where = {
      isActive: true,
      isDeleted: false,
    }

    const [totalItems, foodItems] = await Promise.all([
      prisma.foodItem.count({ where }),
      prisma.foodItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          restaurantSeller: { select: { user: { select: { name: true } } } },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedFeed = foodItems.map((fi, index) => {
      let imageUrl: string | null = null
      if (Array.isArray(fi.images) && fi.images.length > 0) {
        imageUrl = String(fi.images[0])
      }

      const totalRating = fi.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = fi.reviews.length > 0 ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 4.7

      const badges = ["BESTSELLER", "FREE DELIVERY", "POPULAR DISH", "MUST TRY"]
      const badge = badges[index % badges.length]

      return {
        id: fi.id,
        title: fi.name,
        description: fi.description || "",
        category: fi.category,
        restaurant_name: fi.restaurantSeller.user?.name || "Gourmet Kitchen",
        is_veg: fi.isVeg,
        image: imageUrl,
        price: fi.price,
        rating,
        review_count: fi.reviews.length,
        delivery_time: "20-30 mins",
        badge,
      }
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      success: true,
      data: {
        items: formattedFeed,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems,
          has_more: page < totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Food recommendations feed API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
