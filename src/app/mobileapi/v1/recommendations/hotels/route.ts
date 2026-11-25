import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray, formatLocationPart, formatRestaurantLocation } from "@/lib/utils"
import { activeHotelSellerWhere } from "@/lib/subscriptions"
import { getRequestPublicOrigin, normalizeHotelMedia } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const cityParam = searchParams.get("city")
    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
      isDeleted: false,
      hotelSeller: activeHotelSellerWhere(),
    }

    if (cityParam && cityParam.trim().length > 0) {
      where.city = { equals: cityParam.trim(), mode: "insensitive" }
    }

    const origin = getRequestPublicOrigin(request)
    const [totalItems, hotels] = await Promise.all([
      prisma.hotel.count({ where }),
      prisma.hotel.findMany({
        where,
        skip,
        take: page === 1 ? Math.max(limit * 3, 30) : limit,
        orderBy: [{ starRating: "desc" }, { createdAt: "desc" }],
        include: {
          hotelSeller: { select: { logo: true, banner: true, mainPhoto: true } },
          rooms: {
            where: { isActive: true, isDeleted: false },
            select: { price: true },
            orderBy: { price: "asc" },
            take: 1,
          },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedFeed = hotels.map((h, index) => {
      const media = normalizeHotelMedia(h, origin)

      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 399
      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0.0

      const badges = ["TOP CHOICE", "FREE CANCELLATION", "POPULAR STAY", "RECOMMENDED"]
      const badge = badges[index % badges.length]

      const city = formatLocationPart(h.city) || "Local"
      const locationText = formatRestaurantLocation({
        street: h.address,
        city: h.city,
        fallback: "Local",
      })

      return {
        id: h.id,
        hotel_id: h.id,
        title: h.name,
        name: h.name,
        city,
        location_text: locationText,
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        images: media.images,
        banner: media.banner,
        logo: media.logo,
        image: media.coverImage,
        image_url: media.coverImage,
        coverImage: media.coverImage,
        price_per_night: startingPrice,
        starting_price_per_night: startingPrice,
        currency: "NLe",
        rating,
        averageRating: rating,
        review_count: h.reviews.length,
        reviewCount: h.reviews.length,
        totalReviews: h.reviews.length,
        reviewsCount: h.reviews.length,
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
    console.error("Hotel recommendations feed API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
