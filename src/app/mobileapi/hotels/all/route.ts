import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET /mobileapi/hotels/all — list all hotels (public) with live rating & review counts. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false"
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 0)) : 50
    const city = searchParams.get("city") || undefined
    const q = (searchParams.get("q") || searchParams.get("search") || "").trim()

    const where: any = {
      isDeleted: false,
      ...(activeOnly ? { isActive: true } : {}),
      hotelSeller: {
        isApproved: true,
        isSuspended: false,
      },
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        where,
        take: limit,
        orderBy: [{ starRating: "desc" }, { createdAt: "desc" }],
        include: {
          rooms: {
            where: { isActive: true, isDeleted: false },
            select: { id: true, name: true, price: true },
            orderBy: { price: "asc" },
          },
          reviews: {
            select: { rating: true },
          },
        },
      }),
      prisma.hotel.count({ where }),
    ])

    const formattedHotels = hotels.map((h) => {
      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 0
      const totalReviews = h.reviews.length
      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const avgRating = totalReviews > 0 ? parseFloat((totalRating / totalReviews).toFixed(1)) : 0.0

      let imageUrl: string | null = h.banner || null
      if (!imageUrl && Array.isArray(h.images) && h.images.length > 0) {
        imageUrl = String(h.images[0])
      }

      return {
        ...h,
        id: h.id,
        hotel_id: h.id,
        name: h.name,
        city: h.city || "",
        address: h.address || "",
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        image_url: imageUrl,
        coverImage: imageUrl,
        starting_price_per_night: startingPrice,
        price_per_night: startingPrice,
        rating: avgRating,
        averageRating: avgRating,
        review_count: totalReviews,
        reviewCount: totalReviews,
        totalReviews,
        reviewsCount: totalReviews,
      }
    })

    return NextResponse.json({
      success: true,
      message: "Hotels fetched successfully",
      data: { hotels: formattedHotels, total },
    })
  } catch (error) {
    console.error("Mobile hotels all API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
