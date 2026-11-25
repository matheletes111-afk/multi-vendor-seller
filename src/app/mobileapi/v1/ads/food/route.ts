import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, toFirstPublicMediaUrl, toPublicMediaUrl } from "@/lib/media-url"

export async function GET(request: NextRequest) {
  try {
    const origin = getRequestPublicOrigin(request)
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
            banner: true,
            mainPhoto: true,
            businessInfo: { select: { businessName: true } },
            user: { select: { name: true, image: true } },
          },
        },
      },
    })

    const formattedAds = ads.map((ad) => {
      const fi = ad.foodItem
      const price = fi ? fi.price : 0
      const totalRating = fi?.reviews.reduce((acc, r) => acc + r.rating, 0) || 0
      const rating = fi?.reviews.length ? parseFloat((totalRating / fi.reviews.length).toFixed(1)) : 0
      const foodImage = toFirstPublicMediaUrl(fi?.images, origin)
      const restaurantLogo = toPublicMediaUrl(ad.restaurantSeller?.logo || ad.restaurantSeller?.user?.image, origin)
      const restaurantBanner = toPublicMediaUrl(ad.restaurantSeller?.banner, origin)
      const restaurantMainPhoto = toPublicMediaUrl(ad.restaurantSeller?.mainPhoto, origin)
      const imageUrl =
        toPublicMediaUrl(ad.mobileCreativeUrl || ad.creativeUrl, origin) ||
        foodImage ||
        restaurantBanner ||
        restaurantMainPhoto ||
        restaurantLogo

      return {
        ad_id: ad.id,
        is_sponsored: true,
        title: ad.title,
        subtitle: ad.description || "Featured Gourmet Restaurant",
        image_url: imageUrl,
        food_image: foodImage,
        food_id: ad.foodItemId,
        restaurant_id: ad.restaurantSellerId,
        restaurant_name:
          ad.restaurantSeller?.businessInfo?.businessName ||
          ad.restaurantSeller?.user?.name ||
          "Featured Kitchen",
        restaurant_logo: restaurantLogo,
        restaurant_banner: restaurantBanner,
        restaurant_main_photo: restaurantMainPhoto,
        price,
        rating,
        averageRating: rating,
        review_count: fi?.reviews.length || 0,
        reviewCount: fi?.reviews.length || 0,
        totalReviews: fi?.reviews.length || 0,
        reviewsCount: fi?.reviews.length || 0,
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
          rating: 0.0,
          averageRating: 0.0,
          review_count: 0,
          reviewCount: 0,
          totalReviews: 0,
          reviewsCount: 0,
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
