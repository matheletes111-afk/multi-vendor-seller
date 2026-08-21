import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/subcategory/:id
 * Retrieve subcategory details and its products with ratings & reviews.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ success: false, error: "Subcategory ID is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const skip = (page - 1) * limit

    const subcategory = await prisma.subcategory.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!subcategory) {
      return NextResponse.json({ success: false, error: "Subcategory not found" }, { status: 404 })
    }

    const productWhere = {
      subcategoryId: subcategory.id,
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    const [totalProducts, rawProducts] = await Promise.all([
      prisma.product.count({ where: productWhere }),
      prisma.product.findMany({
        where: productWhere,
        skip,
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
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
        minPrice: basePrice,
        maxPrice: basePrice,
        discount: discount > 0 ? discount : null,
        averageRating,
        reviewsCount,
        totalReviews: reviewsCount,
        category: p.category,
        seller: p.seller,
        isFeatured: p.isFeatured,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: subcategory.id,
        name: subcategory.name,
        slug: subcategory.slug,
        image: subcategory.image,
        description: subcategory.description,
        category: subcategory.category,
        products,
        productsCount: totalProducts,
        pagination: {
          page,
          limit,
          total: totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
          hasMore: page < Math.ceil(totalProducts / limit),
        },
      },
    })
  } catch (error) {
    console.error("Subcategory API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
