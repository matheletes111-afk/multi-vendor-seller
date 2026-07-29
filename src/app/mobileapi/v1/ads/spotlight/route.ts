import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slot = searchParams.get("slot") || "home_mid_1"
    const type = searchParams.get("type") // "product" | "service" | "food" | "hotel"

    const where: any = {
      status: "ACTIVE",
    }

    if (type === "product") where.productId = { not: null }
    else if (type === "service") where.serviceId = { not: null }
    else if (type === "food") where.OR = [{ foodItemId: { not: null } }, { restaurantSellerId: { not: null } }]
    else if (type === "hotel") where.OR = [{ hotelId: { not: null } }, { hotelSellerId: { not: null } }]

    const ads = await prisma.sellerAd.findMany({
      where,
      take: 1,
      orderBy: { createdAt: "desc" },
    })

    if (ads.length > 0) {
      const ad = ads[0]
      return NextResponse.json({
        success: true,
        data: {
          ad_id: ad.id,
          is_sponsored: true,
          title: ad.title,
          subtitle: ad.description || "Sponsored Spotlight",
          image_url: ad.mobileCreativeUrl || ad.creativeUrl,
          slot,
          cta_text: "Discover Now",
          click_url: ad.productId
            ? `/products/${ad.productId}`
            : ad.serviceId
            ? `/services/${ad.serviceId}`
            : ad.foodItemId
            ? `/food/${ad.foodItemId}`
            : ad.hotelId
            ? `/hotels/${ad.hotelId}`
            : "/promotions",
        },
      })
    }

    // Default fallback spotlight ad card per slot/type
    const fallbackAd = {
      ad_id: `ad_spotlight_${slot}`,
      is_sponsored: true,
      title: type === "service"
        ? "Professional Villa Deep Cleaning"
        : type === "food"
        ? "Gourmet Artisan Burger Combo"
        : type === "hotel"
        ? "5-Star Luxury Resort Staycation"
        : "Exclusive Wireless ANC Headphones",
      subtitle: "Sponsored Spotlight Unit",
      image_url: type === "service"
        ? "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80"
        : type === "food"
        ? "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
        : type === "hotel"
        ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
        : "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      slot,
      cta_text: "Shop Now",
      click_url: "/browse",
    }

    return NextResponse.json({
      success: true,
      data: fallbackAd,
    })
  } catch (error) {
    console.error("Spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
