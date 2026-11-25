import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray, parseCleanStringArray, formatLocationPart, formatRestaurantLocation } from "@/lib/utils"
import { getRequestPublicOrigin, toPublicMediaUrl } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET: List approved restaurant sellers for mobile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""
    const cuisine = searchParams.get("cuisine") || ""
    const category = searchParams.get("category") || ""

    const where: any = {
      isApproved: true,
      isSuspended: false
    }

    if (q) {
      where.OR = [
        {
          businessInfo: {
            businessName: { contains: q, mode: "insensitive" }
          }
        },
        {
          user: {
            name: { contains: q, mode: "insensitive" }
          }
        }
      ]
    }

    const restaurants = await prisma.restaurantSeller.findMany({
      where,
      include: {
        businessInfo: true,
        user: {
          select: {
            name: true,
            image: true
          }
        },
        foods: {
          where: {
            isDeleted: false,
            isActive: true
          },
          include: {
            reviews: {
              select: {
                rating: true
              }
            }
          }
        }
      }
    })

    const formatted = restaurants.map(r => {
      const cuisines = parseCleanStringArray(r.primaryCuisine)

      // Filter by cuisine if requested
      if (cuisine && cuisine !== "ALL" && !cuisines.some(c => c.toLowerCase() === cuisine.toLowerCase())) {
        return null
      }

      // Filter by food category if requested
      if (category && category !== "ALL" && !r.foods.some(f => f.category.toLowerCase() === category.toLowerCase())) {
        return null
      }

      let totalRatingsSum = 0
      let totalReviewsCount = 0
      r.foods.forEach(f => {
        f.reviews.forEach(rev => {
          totalRatingsSum += rev.rating
          totalReviewsCount++
        })
      })

      const averageRating = totalReviewsCount > 0
        ? parseFloat((totalRatingsSum / totalReviewsCount).toFixed(1))
        : 0

      const street = formatLocationPart(r.businessInfo?.street)
      const city = formatLocationPart(r.businessInfo?.city)
      const state = formatLocationPart(r.businessInfo?.state)
      const landmark = formatLocationPart(r.businessInfo?.landmark)
      const locationText = formatRestaurantLocation({
        landmark,
        street,
        city,
        state,
        fallback: "Local",
      })

      return {
        id: r.id,
        restaurant_id: r.id,
        name: r.businessInfo?.businessName || r.user.name || "Restaurant",
        businessName: r.businessInfo?.businessName || r.user.name || "Restaurant",
        cuisines,
        cuisine_type: cuisines.join(", "),
        logo: toPublicMediaUrl(r.logo, getRequestPublicOrigin(request)),
        banner: toPublicMediaUrl(r.banner, getRequestPublicOrigin(request)),
        mainPhoto: toPublicMediaUrl(r.mainPhoto, getRequestPublicOrigin(request)),
        image_url: toPublicMediaUrl(r.mainPhoto || r.banner || r.logo || r.user.image || null, getRequestPublicOrigin(request)),
        street,
        city,
        state,
        landmark,
        locationText,
        location_text: locationText,
        rating: averageRating,
        averageRating,
        review_count: totalReviewsCount,
        reviewCount: totalReviewsCount,
        totalReviews: totalReviewsCount,
        reviewsCount: totalReviewsCount,
        hasVeg: r.foods.some(f => f.isVeg),
        hasNonVeg: r.foods.some(f => !f.isVeg)
      }
    }).filter(Boolean)

    // Collect all unique cuisines dynamically
    const allCuisinesSet = new Set<string>()
    restaurants.forEach(r => {
      parseCleanStringArray(r.primaryCuisine).forEach(c => allCuisinesSet.add(c))
    })

    const finalData = q ? formatted : shuffleArray(formatted)

    return NextResponse.json(
      {
        success: true,
        data: finalData,
        cuisines: Array.from(allCuisinesSet),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Mobile restaurants GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
