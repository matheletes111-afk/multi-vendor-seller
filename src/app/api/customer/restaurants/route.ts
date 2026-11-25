import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray, fairMarketplaceInterleave, parseCleanStringArray, formatLocationPart } from "@/lib/utils"
import { toFirstPublicMediaUrl, toPublicMediaUrl } from "@/lib/media-url"

export const dynamic = "force-dynamic"
export const revalidate = 0

function parseCuisines(primaryCuisine: any): string[] {
  return parseCleanStringArray(primaryCuisine)
}

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
          businessInfo: {
            city: { contains: q, mode: "insensitive" }
          }
        },
        {
          user: {
            name: { contains: q, mode: "insensitive" }
          }
        },
        {
          primaryCuisine: { contains: q, mode: "insensitive" }
        },
        {
          foods: {
            some: {
              isDeleted: false,
              isActive: true,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } }
              ]
            }
          }
        }
      ]
    }

    // Fetch all active approved restaurants
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

    // Calculate ratings, cuisines list, and format
    const formatted = restaurants.map(r => {
      // Collect cuisines
      const cuisines = parseCuisines(r.primaryCuisine)

      // Filter by cuisine if requested
      if (cuisine && cuisine !== "ALL" && !cuisines.some(c => c.toLowerCase() === cuisine.toLowerCase())) {
        return null
      }

      // Filter by food category if requested
      if (category && category !== "ALL" && !r.foods.some(f => f.category.toLowerCase() === category.toLowerCase())) {
        return null
      }

      // Calculate average rating across all foods
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

      // Format randomized preview foods (max 4 for listing card)
      const previewFoods = shuffleArray(r.foods).slice(0, 4).map(f => {
        const firstImage = toFirstPublicMediaUrl(f.images)
        const sellingPrice = Math.max(0, f.price - (f.discount || 0))
        return {
          id: f.id,
          name: f.name,
          price: f.price,
          discount: f.discount || 0,
          sellingPrice,
          image: firstImage,
          isVeg: f.isVeg,
          category: f.category
        }
      })

      return {
        id: r.id,
        businessName: r.businessInfo?.businessName || r.user.name || "Restaurant",
        cuisines,
        logo: toPublicMediaUrl(r.logo),
        banner: toPublicMediaUrl(r.banner),
        mainPhoto: toPublicMediaUrl(r.mainPhoto),
        street: formatLocationPart(r.businessInfo?.street),
        city: formatLocationPart(r.businessInfo?.city),
        state: formatLocationPart(r.businessInfo?.state),
        averageRating,
        totalReviews: totalReviewsCount,
        hasVeg: r.foods.some(f => f.isVeg),
        hasNonVeg: r.foods.some(f => !f.isVeg),
        totalFoods: r.foods.length,
        previewFoods
      }
    }).filter(Boolean)

    // Dynamic list of unique cuisines across all active restaurants
    const allCuisinesSet = new Set<string>()
    restaurants.forEach(r => {
      const cuisines = parseCuisines(r.primaryCuisine)
      cuisines.forEach(c => allCuisinesSet.add(c))
    })

    const validRestaurants = formatted.filter((r): r is NonNullable<typeof r> => r !== null)
    const randomizedRestaurants = fairMarketplaceInterleave(validRestaurants, (r) => r.id)

    return NextResponse.json(
      {
        success: true,
        data: randomizedRestaurants,
        cuisines: Array.from(allCuisinesSet),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching restaurants:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
