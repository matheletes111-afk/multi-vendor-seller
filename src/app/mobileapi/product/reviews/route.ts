import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

/**
 * POST /mobileapi/product/reviews
 * Payload: { productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json()
    if (!productId) return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 })

    const [product, ratingAgg, reviewsWithCommentsCount] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          _count: { select: { reviews: true } },
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              user: { select: { name: true, image: true } },
              orderItem: {
                include: {
                  productVariant: { select: { name: true, attributes: true } }
                }
              }
            }
          }
        }
      }),
      prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true }
      }),
      prisma.review.count({
        where: { 
          productId,
          NOT: [
            { comment: null },
            { comment: "" }
          ]
        }
      })
    ])

    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })

    // Extract unique images for gallery
    const reviewGallery: string[] = []
    product.reviews.forEach(r => {
      if (r.images && Array.isArray(r.images)) {
        r.images.forEach(img => {
          if (typeof img === 'string') reviewGallery.push(img)
        })
      }
    })

    // Format detailed reviews
    const detailedReviews = product.reviews.map(r => {
      const safeName = (r.user?.name || "").trim()
      const reviewerName = safeName ? safeName : "Verified buyer"
      
      let variantInfo = r.orderItem?.productVariant?.name || ""
      const attrs = r.orderItem?.productVariant?.attributes as Record<string, any>
      if (attrs && typeof attrs === 'object') {
        const attrStrings = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`)
        if (attrStrings.length > 0) variantInfo = attrStrings.join(", ")
      }

      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        images: Array.isArray(r.images) ? r.images : [],
        createdAt: r.createdAt.toISOString(),
        isVerified: r.isVerified,
        reviewerName,
        reviewerImage: r.user?.image,
        variantInfo
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        averageRating: Number(ratingAgg._avg.rating ?? 0).toFixed(1),
        totalRatings: product._count.reviews,
        totalReviewsWithComments: reviewsWithCommentsCount,
        reviewGallery: Array.from(new Set(reviewGallery)),
        detailedReviews
      }
    })
  } catch (error) {
    console.error("Mobile public product reviews API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
