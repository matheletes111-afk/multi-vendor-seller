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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const cityParam = searchParams.get("city")

    const where: any = {
      isActive: true,
      isDeleted: false,
      hotelSeller: activeHotelSellerWhere(),
    }

    if (cityParam && cityParam.trim().length > 0) {
      where.city = { equals: cityParam.trim(), mode: "insensitive" }
    }

    const origin = getRequestPublicOrigin(request)
    const hotels = await prisma.hotel.findMany({
      where,
      take: Math.max(limit * 3, 30),
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
    })

    const formattedHotels = hotels.map((h, index) => {
      const media = normalizeHotelMedia(h, origin)
      const cover = media.coverImage || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80"

      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 399
      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0.0

      const badges = ["FEATURED", "POPULAR CHOICE", "SPECIAL OFFER", "TOP RATED"]
      const badgeText = badges[index % badges.length]

      const city = formatLocationPart(h.city) || "Local"
      const locationText = formatRestaurantLocation({
        street: h.address,
        city: h.city,
        fallback: "Local",
      })

      return {
        id: h.id,
        hotel_id: h.id,
        name: h.name,
        description: h.description || "",
        location_text: locationText,
        city,
        address: formatLocationPart(h.address),
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        images: media.images,
        banner: media.banner,
        image_url: cover,
        coverImage: cover,
        logo: media.logo,
        starting_price_per_night: startingPrice,
        price_per_night: startingPrice,
        currency: "NLe",
        rating,
        averageRating: rating,
        review_count: h.reviews.length,
        reviewCount: h.reviews.length,
        totalReviews: h.reviews.length,
        reviewsCount: h.reviews.length,
        badge_text: badgeText,
        amenities: Array.isArray(h.amenities) ? h.amenities : [],
      }
    })

    const randomizedHotels = shuffleArray(formattedHotels).slice(0, limit)

    return NextResponse.json(
      {
        success: true,
        data: randomizedHotels,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Featured hotels API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
