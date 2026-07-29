import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const latParam = searchParams.get("lat") || request.headers.get("x-user-latitude")
    const lngParam = searchParams.get("lng") || request.headers.get("x-user-longitude")
    const cityParam = searchParams.get("city")
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "5", 10)))

    const where: any = {
      isActive: true,
      isDeleted: false,
    }

    if (cityParam && cityParam.trim().length > 0) {
      where.city = { equals: cityParam.trim(), mode: "insensitive" }
    }

    const hotels = await prisma.hotel.findMany({
      where,
      take: limit,
      orderBy: [{ starRating: "desc" }, { createdAt: "desc" }],
      include: {
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
      let imageUrl: string | null = h.banner || null
      if (!imageUrl && Array.isArray(h.images) && h.images.length > 0) {
        imageUrl = String(h.images[0])
      }

      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 399
      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 4.8

      const badges = ["NEARBY RESORT", "POPULAR CHOICE", "FREE CANCELLATION", "TOP RATED"]
      const badgeText = badges[index % badges.length]

      return {
        hotel_id: h.id,
        name: h.name,
        location_text: `${h.address || "Downtown"}, ${h.city || "Dubai"}`,
        city: h.city || "Dubai",
        star_rating: h.starRating,
        image_url: imageUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
        rating,
        review_count: h.reviews.length || 38,
        price_per_night: startingPrice,
        currency: "AED",
        badge_text: badgeText,
        booking_cta: "View Rooms",
      }
    })

    // Fallback preview hotels if DB has no active hotels yet
    if (formattedHotels.length === 0) {
      const fallbacks = [
        {
          hotel_id: "hotel_nearby_1",
          name: "Grand Palace Hotel & Marina Resort",
          location_text: "Dubai Marina, Dubai",
          city: "Dubai",
          star_rating: 5,
          image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
          rating: 4.9,
          review_count: 142,
          price_per_night: 599,
          currency: "AED",
          badge_text: "POPULAR CHOICE",
          booking_cta: "View Rooms",
        },
        {
          hotel_id: "hotel_nearby_2",
          name: "The Ritz Metropolitan Suites",
          location_text: "Downtown Dubai, Dubai",
          city: "Dubai",
          star_rating: 5,
          image_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
          rating: 4.8,
          review_count: 86,
          price_per_night: 449,
          currency: "AED",
          badge_text: "FREE CANCELLATION",
          booking_cta: "View Rooms",
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: formattedHotels,
    })
  } catch (error) {
    console.error("Nearby hotels API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
