import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const ads = await prisma.sellerAd.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { hotelId: { not: null } },
          { hotelSellerId: { not: null } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        hotel: {
          include: {
            rooms: { select: { price: true }, take: 1 },
            reviews: { select: { rating: true } },
          },
        },
      },
    })

    const formattedAds = ads.map((ad) => {
      const h = ad.hotel
      const price = h?.rooms[0]?.price || 499
      const totalRating = h?.reviews.reduce((acc, r) => acc + r.rating, 0) || 0
      const rating = h?.reviews.length ? parseFloat((totalRating / h.reviews.length).toFixed(1)) : 0

      return {
        ad_id: ad.id,
        is_sponsored: true,
        title: ad.title,
        subtitle: ad.description || "Featured Resort & Hotel Spotlight",
        image_url: ad.mobileCreativeUrl || ad.creativeUrl,
        hotel_id: ad.hotelId,
        city: h?.city || "Dubai",
        star_rating: h?.starRating || 0,
        starRating: h?.starRating || 0,
        starting_price_per_night: price,
        currency: "NLe",
        rating,
        averageRating: rating,
        review_count: h?.reviews.length || 0,
        reviewCount: h?.reviews.length || 0,
        totalReviews: h?.reviews.length || 0,
        reviewsCount: h?.reviews.length || 0,
        cta_text: "Book Stay",
        click_url: `/hotels/${ad.hotelId}`,
      }
    })

    // Fallback sponsored ad if DB has no active seller ads yet
    if (formattedAds.length === 0) {
      const fallbackAd = [
        {
          ad_id: "ad_hotel_spotlight_1",
          is_sponsored: true,
          title: "Luxury Palm Jumeirah Villa Resort",
          subtitle: "Private Pool & Beach Access - Sponsored Spotlight",
          image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
          hotel_id: "hotel_spotlight_1",
          city: "Dubai",
          starting_price_per_night: 899,
          currency: "NLe",
          rating: 0.0,
          averageRating: 0.0,
          review_count: 0,
          reviewCount: 0,
          totalReviews: 0,
          reviewsCount: 0,
          cta_text: "Book Stay",
          click_url: "/hotels/palm-jumeirah-villa",
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbackAd,
      })
    }

    return NextResponse.json({
      success: true,
      data: formattedAds,
    })
  } catch (error) {
    console.error("Hotel spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
