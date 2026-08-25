import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get("category")
    const subcategoryParam = searchParams.get("subcategory")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
    const skip = (page - 1) * limit

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

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
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

    const formattedProducts = products.map((p) => {
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

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalItems,
          has_more: page < totalPages,
        },
      },
    })
  } catch (error) {
    console.error("Products by category API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
