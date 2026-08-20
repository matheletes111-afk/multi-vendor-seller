import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Product ID is required"
      }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { 
        id, 
        isActive: true,
        isDeleted: false,
        seller: {
          isApproved: true,
          isSuspended: false,
        },
      },
      include: {
        category: true,
        seller: { 
          include: { 
            store: true 
          } 
        },
        variants: true,
        sellerAds: true,
        _count: { 
          select: { 
            reviews: true 
          } 
        },
      },
    })

    if (!product) {
      return NextResponse.json({
        success: false,
        error: "Product not found"
      }, { status: 404 })
    }

    const firstVariantAttrs = (product.variants?.[0]?.attributes as Record<string, unknown>) || {}
    const brand = typeof (firstVariantAttrs.brand ?? firstVariantAttrs.Brand ?? firstVariantAttrs.BRAND) === "string"
      ? String(firstVariantAttrs.brand ?? firstVariantAttrs.Brand ?? firstVariantAttrs.BRAND).trim() || null
      : null

    const cleanVariants = product.variants.map((v) => {
      if (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
        const attrs = { ...(v.attributes as Record<string, unknown>) }
        delete attrs.brand
        delete attrs.Brand
        delete attrs.BRAND
        return {
          ...v,
          attributes: attrs,
        }
      }
      return v
    })

    const [ratingAgg] = await Promise.all([
      prisma.review.aggregate({
        where: { productId: id },
        _avg: { rating: true },
      }),
    ])

    const averageRating = parseFloat(Number(ratingAgg._avg.rating ?? 0).toFixed(1))
    const reviewsCount = product._count?.reviews ?? 0

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        variants: cleanVariants,
        brand,
        averageRating,
        totalRatings: reviewsCount,
        reviewsCount,
        totalReviews: reviewsCount,
      }
    } as any)

  } catch (error) {
    console.error("Product API error:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 })
  }
}