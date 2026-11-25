import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { shuffleArray, fairMarketplaceInterleave, formatLocationPart } from "@/lib/utils"
import { activeHotelSellerWhere } from "@/lib/subscriptions"
import { getRequestPublicOrigin, normalizeHotelMedia } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityParam = searchParams.get("city")
    const starRatingParam = searchParams.get("star_rating")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
      isDeleted: false,
      hotelSeller: activeHotelSellerWhere(),
    }

    if (cityParam && cityParam.trim().length > 0) {
      where.city = { equals: cityParam.trim(), mode: "insensitive" }
    }

    if (starRatingParam) {
      const parsedRating = parseInt(starRatingParam, 10)
      if (!isNaN(parsedRating)) {
        where.starRating = parsedRating
      }
    }

    const origin = getRequestPublicOrigin(request)
    const isDefaultView = !cityParam && !starRatingParam && page === 1

    const [totalItems, hotels] = await Promise.all([
      prisma.hotel.count({ where }),
      prisma.hotel.findMany({
        where,
        skip: isDefaultView ? 0 : skip,
        take: isDefaultView ? Math.max(limit * 6, 60) : limit,
        orderBy: { starRating: "desc" },
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

    const formattedHotels = hotels.map((h) => {
      const media = normalizeHotelMedia(h, origin)

      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 299

      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0.0

      return {
        id: h.id,
        hotel_id: h.id,
        hotel_seller_id: h.hotelSellerId,
        name: h.name,
        description: h.description || "",
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        city: formatLocationPart(h.city) || "Local",
        address: formatLocationPart(h.address),
        images: media.images,
        banner: media.banner,
        image_url: media.coverImage,
        coverImage: media.coverImage,
        logo: media.logo,
        starting_price_per_night: startingPrice,
        currency: "NLe",
        rating,
        averageRating: rating,
        review_count: h.reviews.length,
        reviewCount: h.reviews.length,
        totalReviews: h.reviews.length,
        reviewsCount: h.reviews.length,
        amenities: Array.isArray(h.amenities) ? h.amenities : [],
      }
    })

    const totalPages = Math.ceil(totalItems / limit)
    const finalHotels = isDefaultView
      ? fairMarketplaceInterleave(formattedHotels, (h) => h.hotel_seller_id || h.id).slice(0, limit)
      : formattedHotels

    return NextResponse.json(
      {
        success: true,
        data: {
          hotels: finalHotels,
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
    console.error("Hotels by city category API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
