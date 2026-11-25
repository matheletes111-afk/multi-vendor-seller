import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray } from "@/lib/utils"
import { activeRestaurantSellerWhere } from "@/lib/subscriptions"
import { getRequestPublicOrigin, toPublicMediaUrl, toPublicMediaUrlList } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

    const where = {
      isActive: true,
      isDeleted: false,
      restaurantSeller: activeRestaurantSellerWhere(),
    }

    const origin = getRequestPublicOrigin(request)
    const [totalItems, foodItems] = await Promise.all([
      prisma.foodItem.count({ where }),
      prisma.foodItem.findMany({
        where,
        skip,
        take: page === 1 ? Math.max(limit * 3, 30) : limit,
        orderBy: { createdAt: "desc" },
        include: {
          restaurantSeller: {
            select: {
              id: true,
              logo: true,
              banner: true,
              mainPhoto: true,
              businessInfo: { select: { businessName: true } },
              user: { select: { name: true, image: true } },
            },
          },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedFeed = foodItems.map((fi, index) => {
      const images = toPublicMediaUrlList(fi.images, origin)
      const imageUrl = images[0] ?? null
      const restaurantLogo = toPublicMediaUrl(
        fi.restaurantSeller.logo || fi.restaurantSeller.user?.image,
        origin
      )

      const totalRating = fi.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = fi.reviews.length > 0 ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 0.0

      const badges = ["BESTSELLER", "FREE DELIVERY", "POPULAR DISH", "MUST TRY"]
      const badge = badges[index % badges.length]

      return {
        id: fi.id,
        food_id: fi.id,
        title: fi.name,
        name: fi.name,
        description: fi.description || "",
        category: fi.category,
        restaurant_id: fi.restaurantSeller.id,
        restaurant_name:
          fi.restaurantSeller.businessInfo?.businessName ||
          fi.restaurantSeller.user?.name ||
          "Gourmet Kitchen",
        restaurant_logo: restaurantLogo,
        is_veg: fi.isVeg,
        isVeg: fi.isVeg,
        images,
        image: imageUrl,
        image_url: imageUrl,
        price: fi.price,
        discount: fi.discount || 0,
        sellingPrice: Math.max(0, fi.price - (fi.discount || 0)),
        selling_price: Math.max(0, fi.price - (fi.discount || 0)),
        rating,
        averageRating: rating,
        review_count: fi.reviews.length,
        reviewCount: fi.reviews.length,
        totalReviews: fi.reviews.length,
        reviewsCount: fi.reviews.length,
        delivery_time: "20-30 mins",
        badge,
      }
    })

    const totalPages = Math.ceil(totalItems / limit)
    const items = page === 1 ? shuffleArray(formattedFeed).slice(0, limit) : formattedFeed

    return NextResponse.json(
      {
        success: true,
        data: {
          items,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalItems,
            has_more: page < totalPages,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Food recommendations feed API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
