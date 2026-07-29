import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const ads = await prisma.sellerAd.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { foodItemId: { not: null } },
          { restaurantSellerId: { not: null } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        foodItem: {
          include: {
            reviews: { select: { rating: true } },
          },
        },
        restaurantSeller: {
          select: {
            id: true,
            logo: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    const formattedAds = ads.map((ad) => {
      const fi = ad.foodItem
      const price = fi ? fi.price : 0
      const totalRating = fi?.reviews.reduce((acc, r) => acc + r.rating, 0) || 0
      const rating = fi?.reviews.length ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 4.8

      return {
        ad_id: ad.id,
        is_sponsored: true,
        title: ad.title,
        subtitle: ad.description || "Featured Gourmet Restaurant",
        image_url: ad.mobileCreativeUrl || ad.creativeUrl,
        food_id: ad.foodItemId,
        restaurant_name: ad.restaurantSeller?.user?.name || "Featured Kitchen",
        price,
        rating,
        review_count: fi?.reviews.length || 52,
        cta_text: "Order Now",
        click_url: ad.foodItemId ? `/food/${ad.foodItemId}` : `/restaurants/${ad.restaurantSellerId}`,
      }
    })

    // Fallback sponsored ad if DB has no active seller ads yet
    if (formattedAds.length === 0) {
      const fallbackAd = [
        {
          ad_id: "ad_food_spotlight_1",
          is_sponsored: true,
          title: "Artisanal Truffle Burger Special",
          subtitle: "Smoky Black Angus Beef & Truffle Mayo - Sponsored",
          image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
          food_id: "food_spotlight_1",
          restaurant_name: "The Gourmet Burger Club",
          price: 49,
          rating: 4.9,
          review_count: 110,
          cta_text: "Order Now",
          click_url: "/food/truffle-burger",
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
    console.error("Food spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
