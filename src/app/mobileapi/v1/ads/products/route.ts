import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const ads = await prisma.sellerAd.findMany({
      where: {
        status: "ACTIVE",
        productId: { not: null },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            variants: { select: { price: true, discount: true }, take: 1 },
            reviews: { select: { rating: true } },
          },
        },
      },
    })

    const formattedAds = ads.map((ad) => {
      const p = ad.product
      const variant = p?.variants[0]
      const price = variant ? Math.max(0, variant.price - (variant.discount || 0)) : 0
      const totalRating = p?.reviews.reduce((acc, r) => acc + r.rating, 0) || 0
      const rating = p?.reviews.length ? parseFloat((totalRating / p.reviews.length).toFixed(1)) : 0

      return {
        ad_id: ad.id,
        is_sponsored: true,
        title: ad.title,
        subtitle: ad.description || "Featured Brand Spotlight",
        image_url: ad.mobileCreativeUrl || ad.creativeUrl,
        product_id: ad.productId,
        price,
        rating,
        review_count: p?.reviews.length || 0,
        cta_text: "Shop Now",
        click_url: `/products/${ad.productId}`,
      }
    })

    // Fallback sponsored ad if DB has no active seller ads yet
    if (formattedAds.length === 0) {
      const fallbackAd = [
        {
          ad_id: "ad_prod_spotlight_1",
          is_sponsored: true,
          title: "Noise Cancelling Headphones Pro",
          subtitle: "Premium Audio Experience - Sponsored Spotlight",
          image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
          product_id: "prod_spotlight_1",
          price: 299,
          rating: 4.9,
          review_count: 142,
          cta_text: "Shop Now",
          click_url: "/products/featured-headphones",
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
    console.error("Product spotlight ad API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
