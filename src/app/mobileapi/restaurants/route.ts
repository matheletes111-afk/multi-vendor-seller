import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

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
      let cuisines: string[] = []
      if (r.primaryCuisine) {
        try {
          cuisines = typeof r.primaryCuisine === "string" 
            ? JSON.parse(r.primaryCuisine) 
            : (r.primaryCuisine as string[])
        } catch {
          cuisines = []
        }
      }

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

      return {
        id: r.id,
        businessName: r.businessInfo?.businessName || r.user.name || "Restaurant",
        cuisines,
        logo: r.logo || null,
        banner: r.banner || null,
        mainPhoto: r.mainPhoto || null,
        street: r.businessInfo?.street || "",
        city: r.businessInfo?.city || "",
        state: r.businessInfo?.state || "",
        averageRating,
        totalReviews: totalReviewsCount,
        hasVeg: r.foods.some(f => f.isVeg),
        hasNonVeg: r.foods.some(f => !f.isVeg)
      }
    }).filter(Boolean)

    // Collect all unique cuisines dynamically
    const allCuisinesSet = new Set<string>()
    restaurants.forEach(r => {
      if (r.primaryCuisine) {
        try {
          const parsed = typeof r.primaryCuisine === "string" 
            ? JSON.parse(r.primaryCuisine) 
            : (r.primaryCuisine as string[])
          if (Array.isArray(parsed)) {
            parsed.forEach(c => allCuisinesSet.add(c))
          }
        } catch {}
      }
    })

    return NextResponse.json({
      success: true,
      data: formatted,
      cuisines: Array.from(allCuisinesSet)
    })
  } catch (error) {
    console.error("Mobile restaurants GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
