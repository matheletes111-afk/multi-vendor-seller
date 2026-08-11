import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get("category")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
      isDeleted: false,
      restaurantSeller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    if (categoryParam && categoryParam.trim().length > 0) {
      where.category = { equals: categoryParam.trim(), mode: "insensitive" }
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
      const rating = fi.reviews.length > 0 ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 4.6

      return {
        food_id: fi.id,
        title: fi.name,
        description: fi.description || "",
        category: fi.category,
        price: fi.price,
        is_veg: fi.isVeg,
        image_url: imageUrl,
        restaurant_name: fi.restaurantSeller.user?.name || "Gourmet Restaurant",
        restaurant_logo: fi.restaurantSeller.logo || null,
        rating,
        review_count: fi.reviews.length,
        delivery_time: "25-35 mins",
      }
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      success: true,
      data: {
        food_items: formattedItems,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems,
          has_more: page < totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Food items by category API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
