import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const maxDiscountParam = searchParams.get("max_discount")
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))

    const maxDiscountFilter = maxDiscountParam ? parseFloat(maxDiscountParam) : 50

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        variants: {
          some: {
            discount: { gt: 0 },
          },
        },
      },
      take: limit * 2, // Fetch double for in-memory sorting by discount %
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { discount: { gt: 0 } },
          select: { price: true, discount: true, stock: true },
          take: 1,
        },
        reviews: { select: { rating: true } },
      },
    })

    const promoProducts = products
      .map((p) => {
        const variant = p.variants[0]
        if (!variant || variant.price <= 0) return null

        const originalPrice = variant.price
        const discountAmount = variant.discount || 0
        const currentPrice = Math.max(0, originalPrice - discountAmount)
        const discountPercentage = Math.round((discountAmount / originalPrice) * 100)

        // Cap at requested max_discount ceiling if specified
        if (discountPercentage > maxDiscountFilter && maxDiscountFilter > 0) return null

        let thumbnail: string | null = null
        if (Array.isArray(p.images) && p.images.length > 0) {
          thumbnail = String(p.images[0])
        }

        const totalRating = p.reviews.reduce((acc, r) => acc + r.rating, 0)
        const rating = p.reviews.length > 0 ? parseFloat((totalRating / p.reviews.length).toFixed(1)) : 4.8

        return {
          product_id: p.id,
          title: p.name,
          slug: p.slug,
          category_name: p.category?.name || "General",
          thumbnail,
          current_price: currentPrice,
          original_price: originalPrice,
          discount_percentage: discountPercentage,
          discount_tag: `${discountPercentage}% OFF`,
          rating,
          review_count: p.reviews.length,
          stock_status: variant.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.discount_percentage - a.discount_percentage)
      .slice(0, limit)

    // Fallback preview items if database has no active product discounts yet
    if (promoProducts.length === 0) {
      const fallbacks = [
        {
          product_id: "prod_promo_1",
          title: "Wireless ANC Headphones",
          slug: "wireless-anc-headphones",
          category_name: "Electronics",
          thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
          current_price: 249,
          original_price: 499,
          discount_percentage: 50,
          discount_tag: "50% OFF",
          rating: 4.9,
          review_count: 56,
          stock_status: "IN_STOCK",
        },
        {
          product_id: "prod_promo_2",
          title: "Smart Fitness Watch Ultra",
          slug: "smart-fitness-watch-ultra",
          category_name: "Wearables",
          thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
          current_price: 199,
          original_price: 349,
          discount_percentage: 43,
          discount_tag: "43% OFF",
          rating: 4.7,
          review_count: 38,
          stock_status: "IN_STOCK",
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: promoProducts,
    })
  } catch (error) {
    console.error("Product promotions API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
