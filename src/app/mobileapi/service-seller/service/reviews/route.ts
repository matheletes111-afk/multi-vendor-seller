import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"

export const dynamic = 'force-dynamic'

/**
 * POST /mobileapi/service-seller/service/reviews
 * Payload: { serviceId: string }
 */
export async function POST(request: NextRequest) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const { serviceId } = await request.json()
    if (!serviceId) return NextResponse.json({ success: false, error: "Service ID is required" }, { status: 400 })

    const [service, ratingAgg, reviewsWithCommentsCount] = await Promise.all([
      prisma.service.findUnique({
        where: { id: serviceId },
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
                  servicePackage: { select: { name: true } }
                }
              }
            }
          }
        }
      }),
      prisma.review.aggregate({
        where: { serviceId },
        _avg: { rating: true }
      }),
      prisma.review.count({
        where: { 
          serviceId,
          NOT: [
            { comment: null },
            { comment: "" }
          ]
        }
      })
    ])

    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    // Extract unique images for gallery
    const reviewGallery: string[] = []
    service.reviews.forEach(r => {
      if (r.images && Array.isArray(r.images)) {
        r.images.forEach(img => {
          if (typeof img === 'string') reviewGallery.push(img)
        })
      }
    })

    // Format detailed reviews
    const detailedReviews = service.reviews.map(r => {
      const safeName = (r.user?.name || "").trim()
      const reviewerName = safeName ? safeName : "Verified buyer"
      
      const variantInfo = r.orderItem?.servicePackage?.name || ""

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
        totalRatings: service._count.reviews,
        totalReviewsWithComments: reviewsWithCommentsCount,
        reviewGallery: Array.from(new Set(reviewGallery)),
        detailedReviews
      }
    })
  } catch (error) {
    console.error("Mobile service reviews API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
