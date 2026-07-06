import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function parseCuisines(primaryCuisine: any): string[] {
  if (!primaryCuisine) return []
  let rawList: any[] = []
  try {
    rawList = typeof primaryCuisine === "string"
      ? JSON.parse(primaryCuisine)
      : (primaryCuisine as any[])
  } catch {
    return []
  }
  if (!Array.isArray(rawList)) return []
  
  const result: string[] = []
  rawList.forEach(item => {
    if (typeof item === "string") {
      const trimmed = item.trim()
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const nested = JSON.parse(trimmed)
          if (Array.isArray(nested)) {
            nested.forEach(n => {
              if (typeof n === "string") result.push(n)
            })
            return
          }
        } catch {}
      }
      result.push(item)
    }
  })
  return result
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
          user: {
            name: { contains: q, mode: "insensitive" }
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

      // Format preview foods (max 4 for listing card)
      const previewFoods = r.foods.slice(0, 4).map(f => {
        let firstImage: string | null = null
        if (Array.isArray(f.images) && f.images.length > 0) {
          firstImage = f.images[0] as string
        } else if (f.images && typeof f.images === "string") {
          try {
            const parsed = JSON.parse(f.images)
            if (Array.isArray(parsed) && parsed.length > 0) firstImage = parsed[0]
          } catch {}
        }
        return {
          id: f.id,
          name: f.name,
          price: f.price,
          image: firstImage,
          isVeg: f.isVeg,
          category: f.category
        }
      })

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

    return NextResponse.json({
      success: true,
      data: formatted,
      cuisines: Array.from(allCuisinesSet)
    })
  } catch (error) {
    console.error("Error fetching restaurants:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
