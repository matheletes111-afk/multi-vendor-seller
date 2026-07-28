import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

    const where = {
      isActive: true,
      isDeleted: false,
    }

    const [totalItems, services] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          serviceCategory: { select: { name: true } },
          seller: { select: { user: { select: { name: true } } } },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedFeed = services.map((s) => {
      const basePrice = s.basePrice || 0
      const discountAmount = s.discount || 0
      const currentPrice = Math.max(0, basePrice - discountAmount)

      let imageUrl: string | null = null
      if (Array.isArray(s.images) && s.images.length > 0) {
        imageUrl = String(s.images[0])
      }

      const totalRating = s.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = s.reviews.length > 0 ? parseFloat((totalRating / s.reviews.length).toFixed(1)) : 4.8

      const badge = discountAmount > 0 ? `${Math.round((discountAmount / basePrice) * 100)}% OFF` : null

      return {
        id: s.id,
        title: s.name,
        slug: s.slug,
        category: s.serviceCategory?.name || "Services",
        provider_name: s.seller.user?.name || "Professional Provider",
        image: imageUrl,
        price: currentPrice,
        original_price: discountAmount > 0 ? basePrice : null,
        duration_mins: s.duration,
        rating,
        review_count: s.reviews.length,
        badge,
      }
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      success: true,
      data: {
        items: formattedFeed,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems,
          has_more: page < totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Service recommendations feed API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
