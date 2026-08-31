import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const maxPriceParam = searchParams.get("max_price")
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))

    const maxPriceFilter = maxPriceParam ? parseFloat(maxPriceParam) : null

    const where: any = {
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      },
      OR: [
        { discount: { gt: 0 } },
        { basePrice: { lte: maxPriceFilter || 999 } },
      ],
    }

    const services = await prisma.service.findMany({
      where,
      take: limit * 2,
      orderBy: { createdAt: "desc" },
      include: {
        serviceCategory: { select: { id: true, name: true, slug: true } },
        seller: { select: { user: { select: { name: true } } } },
        reviews: { select: { rating: true } },
      },
    })

    const promoServices = services
      .map((s) => {
        const basePrice = s.basePrice || 0
        const discountAmount = s.discount || 0
        const currentPrice = Math.max(0, basePrice - discountAmount)
        const discountPercentage = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0

        // If max_price param was supplied, filter out prices higher than max_price
        if (maxPriceFilter && currentPrice > maxPriceFilter) return null

        let imageUrl: string | null = null
        if (Array.isArray(s.images) && s.images.length > 0) {
          imageUrl = String(s.images[0])
        }

        const totalRating = s.reviews.reduce((acc, r) => acc + r.rating, 0)
        const rating = s.reviews.length > 0 ? parseFloat((totalRating / s.reviews.length).toFixed(1)) : 0.0

        const badgeText = discountPercentage > 0
          ? `${discountPercentage}% OFF`
          : maxPriceFilter
          ? `UNDER NLe ${Math.round(maxPriceFilter)}`
          : "SPECIAL DEAL"

        return {
          service_id: s.id,
          title: s.name,
          slug: s.slug,
          category_name: s.serviceCategory?.name || "Home Services",
          provider_name: s.seller?.user?.name || "Professional Provider",
          image_url: imageUrl,
          price: currentPrice,
          current_price: currentPrice,
          original_price: discountAmount > 0 ? basePrice : null,
          discount_percentage: discountPercentage,
          discount_tag: badgeText,
          duration_mins: s.duration,
          rating,
          averageRating: rating,
          review_count: s.reviews.length,
          reviewCount: s.reviews.length,
          totalReviews: s.reviews.length,
          reviewsCount: s.reviews.length,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, limit)

    // Fallback preview items if DB has no discounted services yet
    if (promoServices.length === 0) {
      const fallbacks = [
        {
          service_id: "srv_promo_1",
          title: "Full AC Deep Cleaning & Sanitization",
          slug: "ac-deep-cleaning",
          category_name: "AC Services",
          image_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
          current_price: 79,
          original_price: 150,
          discount_percentage: 47,
          discount_tag: "47% OFF",
          duration_mins: 60,
          rating: 0.0,
          averageRating: 0.0,
          review_count: 0,
          reviewCount: 0,
          totalReviews: 0,
          reviewsCount: 0,
        },
        {
          service_id: "srv_promo_2",
          title: "Express Home Plumbing Check",
          slug: "express-home-plumbing",
          category_name: "Plumbing",
          image_url: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=400&q=80",
          current_price: 49,
          original_price: 99,
          discount_percentage: 50,
          discount_tag: "50% OFF",
          duration_mins: 45,
          rating: 0.0,
          averageRating: 0.0,
          review_count: 0,
          reviewCount: 0,
          totalReviews: 0,
          reviewsCount: 0,
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: promoServices,
    })
  } catch (error) {
    console.error("Service promotions API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
