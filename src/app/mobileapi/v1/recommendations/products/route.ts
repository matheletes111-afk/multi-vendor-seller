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
      seller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { name: true } },
          variants: { select: { price: true, discount: true, stock: true }, take: 1 },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    const formattedFeed = products.map((p) => {
      const variant = p.variants[0]
      const originalPrice = variant ? variant.price : 0
      const discountAmount = variant ? (variant.discount || 0) : 0
      const currentPrice = Math.max(0, originalPrice - discountAmount)

      let imageUrl: string | null = null
      if (Array.isArray(p.images) && p.images.length > 0) {
        imageUrl = String(p.images[0])
      }

      const totalRating = p.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = p.reviews.length > 0 ? parseFloat((totalRating / p.reviews.length).toFixed(1)) : 4.8

      const badge = discountAmount > 0 ? `${Math.round((discountAmount / originalPrice) * 100)}% OFF` : null

      return {
        id: p.id,
        title: p.name,
        slug: p.slug,
        category: p.category?.name || "General",
        image: imageUrl,
        price: currentPrice,
        original_price: discountAmount > 0 ? originalPrice : null,
        rating,
        review_count: p.reviews.length,
        badge,
        in_stock: variant ? variant.stock > 0 : true,
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
    console.error("Product recommendations feed API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
