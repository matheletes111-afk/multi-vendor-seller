import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get("city") || undefined
    const rating = searchParams.get("rating") ? parseInt(searchParams.get("rating")!) : undefined
    const query = searchParams.get("q") || undefined
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined

    const whereCondition: any = {
      isActive: true,
      isDeleted: false,
      hotelSeller: {
        isApproved: true,
        isSuspended: false,
      },
      city: city ? { contains: city, mode: "insensitive" } : undefined,
      starRating: rating ? { gte: rating } : undefined,
      OR: query ? [
        { name: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { rooms: { some: { name: { contains: query, mode: "insensitive" }, isActive: true, isDeleted: false } } },
        ...(!isNaN(Number(query)) && Number(query) > 0 ? [{ rooms: { some: { price: { equals: Number(query) }, isActive: true, isDeleted: false } } }] : []),
      ] : undefined,
      rooms: {
        some: {
          isActive: true,
          isDeleted: false,
          ...(maxPrice !== undefined ? { price: { lte: maxPrice } } : {})
        }
      }
    }

    if (minPrice !== undefined) {
      whereCondition.AND = [
        {
          rooms: {
            none: {
              isActive: true,
              isDeleted: false,
              price: { lt: minPrice }
            }
          }
        }
      ]
    }

    const [hotels, distinctCities] = await Promise.all([
      prisma.hotel.findMany({
        where: whereCondition,
        include: {
          rooms: {
            where: { isActive: true, isDeleted: false },
            orderBy: { price: "asc" }
          },
          reviews: {
            select: { rating: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.hotel.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          hotelSeller: {
            isApproved: true,
            isSuspended: false,
          }
        },
        select: { city: true },
        distinct: ["city"]
      })
    ])

    const formattedHotels = hotels.map((h) => {
      const startingPrice = h.rooms.length > 0 ? h.rooms[0].price : 0
      const totalReviews = h.reviews.length
      const totalRating = h.reviews.reduce((acc, r) => acc + r.rating, 0)
      const avgRating = totalReviews > 0 ? parseFloat((totalRating / totalReviews).toFixed(1)) : 0.0

      return {
        ...h,
        hotel_id: h.id,
        id: h.id,
        name: h.name,
        city: h.city || "",
        address: h.address || "",
        starting_price_per_night: startingPrice,
        star_rating: h.starRating ?? 0,
        starRating: h.starRating ?? 0,
        rating: avgRating,
        averageRating: avgRating,
        review_count: totalReviews,
        totalReviews,
        reviewsCount: totalReviews,
      }
    })

    const citiesList = distinctCities
      .map((h) => h.city)
      .filter((c): c is string => !!c && c.trim() !== "")

    return NextResponse.json({ success: true, data: formattedHotels, cities: citiesList })
  } catch (error) {
    console.error("Error fetching mobile hotels list:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
