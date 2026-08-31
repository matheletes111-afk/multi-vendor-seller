import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    const dealEndsAt = endOfDay.toISOString()

    const hotels = await prisma.hotel.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        hotelSeller: {
          isApproved: true,
          isSuspended: false,
        },
      },
      take: limit * 2,
      orderBy: { updatedAt: "desc" },
      include: {
        rooms: {
          where: { isActive: true, isDeleted: false },
          select: { id: true, name: true, price: true },
          orderBy: { price: "asc" },
          take: 1,
        },
        reviews: { select: { rating: true } },
      },
    })

    const deals = hotels
      .map((h, index) => {
        const room = h.rooms[0]
        const basePrice = room ? room.price : 499
        const discountPercentage = 15 + ((index * 7) % 25)
        const discountedPrice = Math.max(0, Math.round(basePrice * (1 - discountPercentage / 100)))

        let imageUrl: string | null = h.banner || null
        if (!imageUrl && Array.isArray(h.images) && h.images.length > 0) {
          imageUrl = String(h.images[0])
        }

        const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
        const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0.0

        return {
          deal_id: `deal_hotel_${h.id}_${index}`,
          id: h.id,
          hotel_id: h.id,
          name: h.name,
          title: h.name,
          city: h.city || "Dubai",
          location_text: `${h.address || "Downtown"}, ${h.city || "Dubai"}`,
          star_rating: h.starRating ?? 0,
          starRating: h.starRating ?? 0,
          image_url: imageUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
          coverImage: imageUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
          price: discountedPrice,
          current_price: discountedPrice,
          price_per_night: discountedPrice,
          starting_price_per_night: discountedPrice,
          original_price: basePrice,
          discount_percentage: discountPercentage,
          discount_badge: `${discountPercentage}% OFF`,
          deal_ends_at: dealEndsAt,
          currency: "NLe",
          rating,
          averageRating: rating,
          review_count: h.reviews.length,
          reviewCount: h.reviews.length,
          totalReviews: h.reviews.length,
          reviewsCount: h.reviews.length,
        }
      })
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: deals,
    })
  } catch (error) {
    console.error("Hotel deals API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
