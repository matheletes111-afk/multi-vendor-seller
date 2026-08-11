import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "6", 10)))

    const hotels = await prisma.hotel.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        hotelSeller: {
          isApproved: true,
          isSuspended: false,
        },
      },
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
      const rating = h.reviews.length > 0 ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0

      const badges = ["NEARBY RESORT", "POPULAR CHOICE", "FREE CANCELLATION", "TOP RATED"]
      const badgeText = badges[index % badges.length]

      return {
        id: h.id,
        name: h.name,
        locationText: `${h.address || "Downtown"}, ${h.city || "Dubai"}`,
        city: h.city || "Dubai",
        starRating: h.starRating,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
        rating,
        reviewCount: h.reviews.length,
        pricePerNight: startingPrice,
        currency: "AED",
        badgeText,
      }
    })

    if (formattedHotels.length === 0) {
      const fallbacks = [
        {
          id: "hotel_web_1",
          name: "Grand Beach Resort & Marina",
          locationText: "Jumeirah Beach, Dubai",
          city: "Dubai",
          starRating: 5,
          imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
          rating: 4.9,
          reviewCount: 142,
          pricePerNight: 750,
          currency: "AED",
          badgeText: "HOT",
        },
        {
          id: "hotel_web_2",
          name: "Skyline Suites & Towers",
          locationText: "Downtown Dubai",
          city: "Dubai",
          starRating: 5,
          imageUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
          rating: 4.8,
          reviewCount: 86,
          pricePerNight: 520,
          currency: "AED",
          badgeText: "HOT",
        },
      ]
      return NextResponse.json(fallbacks)
    }

    return NextResponse.json(formattedHotels)
  } catch (error: any) {
    console.error("Web home hotels error:", error)
    return NextResponse.json([], { status: 500 })
  }
}
