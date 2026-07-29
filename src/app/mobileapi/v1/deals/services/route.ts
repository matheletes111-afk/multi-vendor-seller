import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))

    // Calculate end of current calendar day timestamp (23:59:59.999 PM)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    const dealEndsAt = endOfDay.toISOString()

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        discount: { gt: 0 },
      },
      take: limit * 2,
      orderBy: { updatedAt: "desc" },
      include: {
        serviceCategory: { select: { id: true, name: true, slug: true } },
        reviews: { select: { rating: true } },
      },
    })

    const deals = services
      .map((s, index) => {
        const basePrice = s.basePrice || 0
        const discountAmount = s.discount || 0
        if (basePrice <= 0 || discountAmount <= 0) return null

        const currentPrice = Math.max(0, basePrice - discountAmount)
        const discountPercentage = Math.round((discountAmount / basePrice) * 100)

        let imageUrl: string | null = null
        if (Array.isArray(s.images) && s.images.length > 0) {
          imageUrl = String(s.images[0])
        }

        const totalRating = s.reviews.reduce((acc, r) => acc + r.rating, 0)
        const rating = s.reviews.length > 0 ? parseFloat((totalRating / s.reviews.length).toFixed(1)) : 4.9

        return {
          deal_id: `deal_srv_${s.id}_${index}`,
          service_id: s.id,
          title: s.name,
          slug: s.slug,
          category_name: s.serviceCategory?.name || "Services",
          image_url: imageUrl,
          current_price: currentPrice,
          original_price: basePrice,
          discount_percentage: discountPercentage,
          discount_badge: `${discountPercentage}% OFF`,
          deal_ends_at: dealEndsAt,
          duration_mins: s.duration,
          rating,
          review_count: s.reviews.length,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.discount_percentage - a.discount_percentage)
      .slice(0, limit)

    // Fallback preview service daily deals if DB has no discounted services yet
    if (deals.length === 0) {
      const fallbacks = [
        {
          deal_id: "deal_srv_fallback_1",
          service_id: "srv_deal_1",
          title: "Full Home Deep Cleaning & Sanitization",
          slug: "home-deep-cleaning",
          category_name: "Cleaning",
          image_url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
          current_price: 99,
          original_price: 199,
          discount_percentage: 50,
          discount_badge: "FLASH 50% OFF",
          deal_ends_at: dealEndsAt,
          duration_mins: 120,
          rating: 4.9,
          review_count: 76,
        },
        {
          deal_id: "deal_srv_fallback_2",
          service_id: "srv_deal_2",
          title: "Express AC Duct Cleaning Special",
          slug: "express-ac-cleaning",
          category_name: "AC Maintenance",
          image_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
          current_price: 79,
          original_price: 149,
          discount_percentage: 47,
          discount_badge: "FLASH 47% OFF",
          deal_ends_at: dealEndsAt,
          duration_mins: 60,
          rating: 4.8,
          review_count: 52,
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: deals,
    })
  } catch (error) {
    console.error("Service deals of the day API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
