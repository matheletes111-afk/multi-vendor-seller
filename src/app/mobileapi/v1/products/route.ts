import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray, fairMarketplaceInterleave } from "@/lib/utils"
import { resolveFeedSeed, parseExcludedIds } from "@/lib/feed-session"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get("category")
    const subcategoryParam = searchParams.get("subcategory")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))

    const effectiveSeed = resolveFeedSeed(
      request,
      page,
      `v1_products_${categoryParam || "all"}_${subcategoryParam || "all"}`
    )
    const excludedIds = parseExcludedIds(searchParams)

    const where: any = {
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    if (categoryParam && categoryParam.trim().length > 0) {
      where.OR = [
        { categoryId: categoryParam },
        { category: { slug: categoryParam } },
        { category: { name: { equals: categoryParam, mode: "insensitive" } } },
      ]
    }

    if (subcategoryParam && subcategoryParam.trim().length > 0) {
      where.AND = [
        {
          OR: [
            { subcategoryId: subcategoryParam },
            { subcategory: { slug: subcategoryParam } },
            { subcategory: { name: { equals: subcategoryParam, mode: "insensitive" } } },
          ],
        },
      ]
    }

    const [totalItems, rawProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        take: 1000,
        orderBy: { createdAt: "desc" },
        include: {
          seller: { select: { id: true, store: { select: { name: true } } } },
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          variants: {
            select: { id: true, price: true, discount: true, stock: true },
            take: 5,
          },
          reviews: { select: { rating: true } },
        },
      }),
    ])

    // Filter out excluded/seen IDs and deduplicate raw products
    const uniqueRawMap = new Map<string, typeof rawProducts[0]>()
    for (const p of rawProducts) {
      if (excludedIds.size > 0 && excludedIds.has(p.id)) continue
      if (!uniqueRawMap.has(p.id)) {
        uniqueRawMap.set(p.id, p)
      }
    }
    const candidateList = Array.from(uniqueRawMap.values())

    // Flipkart/Amazon fair seller interleaving with deterministic session seed
    const interleaved = fairMarketplaceInterleave(
      candidateList,
      (p) => p.sellerId || p.seller?.id || p.seller?.store?.name || "unknown",
      effectiveSeed
    )

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    const pagedProducts = interleaved.slice((page - 1) * limit, page * limit)

    const formattedProducts = pagedProducts.map((p) => {
      const variant = p.variants[0]
      const originalPrice = variant ? variant.price : 0
      const discountAmount = variant ? (variant.discount || 0) : 0
      const finalPrice = Math.max(0, originalPrice - discountAmount)
      const discountTag =
        discountAmount > 0 && originalPrice > 0
          ? `${Math.round((discountAmount / originalPrice) * 100)}% OFF`
          : null

      let thumbnail: string | null = null
      if (Array.isArray(p.images) && p.images.length > 0) {
        thumbnail = String(p.images[0])
      }

      const totalRating = p.reviews.reduce((acc, r) => acc + r.rating, 0)
      const rating = p.reviews.length > 0 ? parseFloat((totalRating / p.reviews.length).toFixed(1)) : 0.0
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0)

      return {
        id: p.id,
        product_id: p.id,
        seller_id: p.sellerId || p.seller?.id,
        title: p.name,
        name: p.name,
        slug: p.slug,
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
        subcategory: p.subcategory ? { id: p.subcategory.id, name: p.subcategory.name, slug: p.subcategory.slug } : null,
        thumbnail_url: thumbnail,
        images: Array.isArray(p.images) ? p.images : thumbnail ? [thumbnail] : [],
        price: finalPrice,
        current_price: finalPrice,
        original_price: discountAmount > 0 ? originalPrice : null,
        originalPrice: discountAmount > 0 ? originalPrice : null,
        discount_tag: discountTag,
        rating,
        averageRating: rating,
        review_count: p.reviews.length,
        reviewCount: p.reviews.length,
        totalReviews: p.reviews.length,
        reviewsCount: p.reviews.length,
        in_stock: totalStock > 0,
        inStock: totalStock > 0,
      }
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          products: formattedProducts,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalItems,
            has_more: page < totalPages,
            seed: effectiveSeed,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Products by category API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
