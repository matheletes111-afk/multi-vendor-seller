import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
        { description: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } }
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

    const citiesList = distinctCities
      .map((h) => h.city)
      .filter((c): c is string => !!c && c.trim() !== "")

    return NextResponse.json({ success: true, data: hotels, cities: citiesList })
  } catch (error) {
    console.error("Error fetching hotels list:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
