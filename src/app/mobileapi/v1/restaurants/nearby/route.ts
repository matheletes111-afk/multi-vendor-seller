import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const latParam = searchParams.get("lat") || request.headers.get("x-user-latitude")
    const lngParam = searchParams.get("lng") || request.headers.get("x-user-longitude")
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "6", 10)))

    const restaurants = await prisma.restaurantSeller.findMany({
      where: {
        isApproved: true,
        isSuspended: false,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, image: true } },
        businessInfo: { select: { city: true, street: true, landmark: true } },
        foods: {
          where: { isActive: true, isDeleted: false },
          select: {
            category: true,
            reviews: { select: { rating: true } },
          },
          take: 10,
        },
      },
    })

    const formattedRestaurants = restaurants.map((r, index) => {
      const cuisineList = Array.from(
        new Set(r.foods.map((fi) => fi.category).filter(Boolean))
      )
      const cuisineType = cuisineList.length > 0 ? cuisineList.join(", ") : "Multi-Cuisine"

      let imageUrl: string | null = r.mainPhoto || r.banner || r.logo || null
      if (!imageUrl && r.user?.image) {
        imageUrl = r.user.image
      }

      // Collect all food item ratings to calculate restaurant average rating
      const allRatings = r.foods.flatMap((f) => f.reviews.map((rev) => rev.rating))
      const totalRating = allRatings.reduce((acc, curr) => acc + curr, 0)
      const rating = allRatings.length > 0 ? parseFloat((totalRating / allRatings.length).toFixed(1)) : 4.8

      const simulatedDistanceKm = parseFloat((1.2 + (index * 0.8)).toFixed(1))
      const deliveryTimeRange = `${20 + index * 5}-${30 + index * 5} mins`

      const offerTags = ["Free Delivery", "20% OFF", "Top Rated", "Express Delivery"]
      const offerTag = offerTags[index % offerTags.length]

      return {
        restaurant_id: r.id,
        name: r.user?.name || "Gourmet Kitchen",
        cuisine_type: cuisineType,
        image_url: imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
        logo: r.logo || null,
        city: r.businessInfo?.city || "Dubai",
        location_text: r.businessInfo?.landmark || r.businessInfo?.street || "Downtown",
        rating,
        review_count: allRatings.length || 42 + index * 12,
        delivery_time_range: deliveryTimeRange,
        distance_km: simulatedDistanceKm,
        offer_tag: offerTag,
      }
    })

    // Fallback preview restaurants if DB has no approved restaurant sellers yet
    if (formattedRestaurants.length === 0) {
      const fallbacks = [
        {
          restaurant_id: "rest_nearby_1",
          name: "The Gourmet Burger Kitchen",
          cuisine_type: "Burgers, Fast Food, Drinks",
          image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
          logo: null,
          city: "Dubai",
          location_text: "Dubai Marina",
          rating: 4.8,
          review_count: 124,
          delivery_time_range: "20-30 mins",
          distance_km: 1.5,
          offer_tag: "Free Delivery",
        },
        {
          restaurant_id: "rest_nearby_2",
          name: "Bella Italia Pizzeria",
          cuisine_type: "Pizza, Italian, Pasta",
          image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
          logo: null,
          city: "Dubai",
          location_text: "Downtown Dubai",
          rating: 4.9,
          review_count: 98,
          delivery_time_range: "25-35 mins",
          distance_km: 2.3,
          offer_tag: "20% OFF",
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: formattedRestaurants,
    })
  } catch (error) {
    console.error("Nearby restaurants API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
