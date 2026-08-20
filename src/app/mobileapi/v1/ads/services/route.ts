import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const ads = await prisma.sellerAd.findMany({
      where: {
        status: "ACTIVE",
        serviceId: { not: null },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        service: {
          include: {
            reviews: { select: { rating: true } },
          },
        },
      },
    })

    const formattedAds = ads.map((ad) => {
      const s = ad.service
      const price = s ? Math.max(0, (s.basePrice || 0) - (s.discount || 0)) : 0
      const totalRating = s?.reviews.reduce((acc, r) => acc + r.rating, 0) || 0
      const rating = s?.reviews.length ? parseFloat((totalRating / s.reviews.length).toFixed(1)) : 0

      return {
        ad_id: ad.id,
        is_sponsored: true,
        title: ad.title,
        subtitle: ad.description || "Top-Rated Service Spotlight",
        image_url: ad.mobileCreativeUrl || ad.creativeUrl,
        service_id: ad.serviceId,
        price,
        rating,
        review_count: s?.reviews.length || 0,
        cta_text: "Book Service",
        click_url: `/services/${ad.serviceId}`,
      }
    })

    // Fallback sponsored ad if DB has no active seller ads yet
    if (formattedAds.length === 0) {
      const fallbackAd = [
        {
          ad_id: "ad_srv_spotlight_1",
          is_sponsored: true,
          title: "Premium Villa Deep Cleaning",
          subtitle: "Eco-Friendly Professional Home Care - Sponsored",
          image_url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
          service_id: "srv_spotlight_1",
          price: 199,
          rating: 4.9,
          review_count: 86,
          cta_text: "Book Service",
          click_url: "/services/villa-deep-cleaning",
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
    console.error("Service spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
