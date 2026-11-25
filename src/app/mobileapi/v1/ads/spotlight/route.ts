import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray } from "@/lib/utils"
import { getRequestPublicOrigin, normalizeHotelMedia, toFirstPublicMediaUrl, toPublicMediaUrl } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

    const candidateAds = await prisma.sellerAd.findMany({
      where,
      take: 20,
      include: {
        product: { select: { images: true } },
        service: { select: { images: true, galleryImages: true } },
        foodItem: { select: { images: true } },
        hotel: {
          select: {
            images: true,
            banner: true,
            logo: true,
            hotelSeller: { select: { logo: true, banner: true, mainPhoto: true } },
          },
        },
        restaurantSeller: { select: { logo: true, banner: true, mainPhoto: true } },
        hotelSeller: { select: { logo: true, banner: true, mainPhoto: true } },
      },
    })

    const ads = shuffleArray(candidateAds)


    const origin = getRequestPublicOrigin(request)
    if (ads.length > 0) {
      const ad = ads[0]
      const fallbackImageUrl =
        toFirstPublicMediaUrl(ad.product?.images, origin) ||
        toFirstPublicMediaUrl(ad.service?.images, origin) ||
        toFirstPublicMediaUrl(ad.service?.galleryImages, origin) ||
        toFirstPublicMediaUrl(ad.foodItem?.images, origin) ||
        (ad.hotel ? normalizeHotelMedia(ad.hotel, origin).coverImage : null) ||
        (ad.hotelSeller ? normalizeHotelMedia({ hotelSeller: ad.hotelSeller }, origin).coverImage : null) ||
        toPublicMediaUrl(
          ad.restaurantSeller?.banner || ad.restaurantSeller?.mainPhoto || ad.restaurantSeller?.logo,
          origin
        )
      return NextResponse.json({
        success: true,
        data: {
          ad_id: ad.id,
          is_sponsored: true,
          title: ad.title,
          subtitle: ad.description || "Sponsored Spotlight",
          image_url: toPublicMediaUrl(ad.mobileCreativeUrl || ad.creativeUrl, origin) || fallbackImageUrl,
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
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
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

    return NextResponse.json(
      {
        success: true,
        data: fallbackAd,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
