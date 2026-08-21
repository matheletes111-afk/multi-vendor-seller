import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/search
 * Search products by query term with ratings & reviews metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || searchParams.get("query") || "").trim()
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const skip = (page - 1) * limit
    const categoryId = searchParams.get("categoryId") || undefined
    const subcategoryId = searchParams.get("subcategoryId") || undefined

    const numQ = Number(q)
    const searchWhere: Prisma.ProductWhereInput = {
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      },
      ...(categoryId ? { categoryId } : {}),
      ...(subcategoryId ? { subcategoryId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { variants: { some: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { variants: { some: { sku: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              { category: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
              { subcategory: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
              { seller: { store: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
              ...(!isNaN(numQ) && numQ > 0 ? [{ variants: { some: { price: { equals: numQ } } } }] : []),
            ],
          }
        : {}),
    }

    const [total, rawProducts] = await Promise.all([
      prisma.product.count({ where: searchWhere }),
      prisma.product.findMany({
        where: searchWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, store: { select: { name: true, logo: true } } } },
          variants: {
            take: 1,
            orderBy: { price: "asc" },
            select: { price: true, discount: true, stock: true },
          },
          _count: { select: { reviews: true } },
        },
      }),
    ])

    const productIds = rawProducts.map((p) => p.id)
    const ratingAggs =
      productIds.length > 0
        ? await prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _avg: { rating: true },
          })
        : []

    const ratingMap = Object.fromEntries(
      ratingAggs.map((r) => [r.productId, parseFloat(Number(r._avg.rating ?? 0).toFixed(1))])
    ) as Record<string, number>

    const products = rawProducts.map((p) => {
      const v = p.variants[0]
      const basePrice = v?.price ?? 0
      const discount = v?.discount ?? 0
      const finalPrice = Math.max(0, basePrice - discount)
      const reviewsCount = p._count?.reviews ?? 0
      const averageRating = ratingMap[p.id] ?? 0.0

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: p.images,
        price: finalPrice,
        originalPrice: discount > 0 ? basePrice : null,
        discountPercentage: basePrice > 0 && discount > 0 ? Math.round((discount / basePrice) * 100) : 0,
        averageRating,
        reviewsCount,
        totalReviews: reviewsCount,
        category: p.category,
        subcategory: p.subcategory,
        seller: p.seller,
        inStock: v ? v.stock > 0 : true,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page < Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
