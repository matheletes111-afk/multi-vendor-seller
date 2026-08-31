import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
      hotelSeller: {
        isApproved: true,
        isSuspended: false,
      },
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

    const [totalItems, hotels] = await Promise.all([
      prisma.hotel.count({ where }),
      prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { starRating: "desc" },
        include: {
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
      let imageUrl: string | null = h.banner || null
      if (!imageUrl && Array.isArray(h.images) && h.images.length > 0) {
        imageUrl = String(h.images[0])
      }

      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 299

      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0.0

      return {
        id: h.id,
        hotel_id: h.id,
        name: h.name,
        description: h.description || "",
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        city: h.city || "Dubai",
        address: h.address || "",
        image_url: imageUrl,
        coverImage: imageUrl,
        logo: h.logo || null,
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

    return NextResponse.json({
      success: true,
      data: {
        hotels: formattedHotels,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems,
          has_more: page < totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Hotels by city category API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
