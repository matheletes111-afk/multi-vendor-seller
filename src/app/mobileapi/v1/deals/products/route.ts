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
      take: limit * 2,
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

    const deals = products
      .map((p, index) => {
        const variant = p.variants[0]
        if (!variant || variant.price <= 0) return null

        const originalPrice = variant.price
        const discountAmount = variant.discount || 0
        const currentPrice = Math.max(0, originalPrice - discountAmount)
        const discountPercentage = Math.round((discountAmount / originalPrice) * 100)

        let imageUrl: string | null = null
        if (Array.isArray(p.images) && p.images.length > 0) {
          imageUrl = String(p.images[0])
        }

        const totalRating = p.reviews.reduce((acc, r) => acc + r.rating, 0)
        const rating = p.reviews.length > 0 ? parseFloat((totalRating / p.reviews.length).toFixed(1)) : 4.8

        const stockStatus =
          variant.stock <= 0
            ? "OUT_OF_STOCK"
            : variant.stock < 5
            ? `ONLY ${variant.stock} LEFT`
            : "IN_STOCK"

        return {
          deal_id: `deal_prod_${p.id}_${index}`,
          product_id: p.id,
          title: p.name,
          slug: p.slug,
          category_name: p.category?.name || "General",
          image_url: imageUrl,
          current_price: currentPrice,
          original_price: originalPrice,
          discount_percentage: discountPercentage,
          discount_badge: `${discountPercentage}% OFF`,
          deal_ends_at: dealEndsAt,
          stock_status: stockStatus,
          rating,
          review_count: p.reviews.length,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.discount_percentage - a.discount_percentage)
      .slice(0, limit)

    // Fallback preview daily deals if DB has no discounted products yet
    if (deals.length === 0) {
      const fallbacks = [
        {
          deal_id: "deal_prod_fallback_1",
          product_id: "prod_deal_1",
          title: "Ultra Slim Smartwatch Pro 2026",
          slug: "ultra-slim-smartwatch-pro",
          category_name: "Wearables",
          image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
          current_price: 149,
          original_price: 299,
          discount_percentage: 50,
          discount_badge: "FLASH 50% OFF",
          deal_ends_at: dealEndsAt,
          stock_status: "ONLY 3 LEFT",
          rating: 4.9,
          review_count: 88,
        },
        {
          deal_id: "deal_prod_fallback_2",
          product_id: "prod_deal_2",
          title: "Wireless ANC Studio Headphones",
          slug: "wireless-anc-studio-headphones",
          category_name: "Electronics",
          image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
          current_price: 219,
          original_price: 399,
          discount_percentage: 45,
          discount_badge: "FLASH 45% OFF",
          deal_ends_at: dealEndsAt,
          stock_status: "IN_STOCK",
          rating: 4.8,
          review_count: 64,
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
    console.error("Product deals of the day API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
