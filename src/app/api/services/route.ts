import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || searchParams.get("query") || searchParams.get("q") || "").trim()
    const serviceCategoryId = searchParams.get("serviceCategoryId") || searchParams.get("categoryId") || undefined
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined
    const minRating = searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined
    const sortBy = searchParams.get("sortBy") || "newest"
    const page = Math.max(1, Number(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "30")))
    const skip = (page - 1) * limit

    const whereCondition: any = {
      isActive: true,
      isDeleted: false,
      seller: {
        isApproved: true,
        isSuspended: false,
      },
    }

    if (serviceCategoryId) {
      whereCondition.serviceCategoryId = serviceCategoryId
    }

    if (search) {
      const numSearch = Number(search)
      whereCondition.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { seller: { store: { name: { contains: search, mode: "insensitive" } } } },
        { seller: { store: { city: { contains: search, mode: "insensitive" } } } },
        { serviceCategory: { name: { contains: search, mode: "insensitive" } } },
        { serviceCategory: { slug: { contains: search, mode: "insensitive" } } },
        ...(!isNaN(numSearch) && numSearch > 0 ? [{ basePrice: { equals: numSearch } }] : []),
      ]
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      whereCondition.basePrice = {}
      if (minPrice !== undefined && !isNaN(minPrice)) whereCondition.basePrice.gte = minPrice
      if (maxPrice !== undefined && !isNaN(maxPrice)) whereCondition.basePrice.lte = maxPrice
    }

    // When no search + default sort on page 1, we randomize — oversample for genuine variety
    const isDefaultView = !search && sortBy === "newest" && page === 1
    const fetchLimit = isDefaultView ? Math.max(limit * 3, 60) : limit
    const fetchSkip = isDefaultView ? 0 : skip

    let orderByClause: any = { createdAt: "desc" }
    if (sortBy === "price_asc") {
      orderByClause = { basePrice: "asc" }
    } else if (sortBy === "price_desc") {
      orderByClause = { basePrice: "desc" }
    }

    const [totalCount, rawServices] = await Promise.all([
      prisma.service.count({ where: whereCondition }),
      prisma.service.findMany({
        where: whereCondition,
        skip: fetchSkip,
        take: fetchLimit,
        orderBy: orderByClause,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          serviceType: true,
          basePrice: true,
          discount: true,
          hasGst: true,
          images: true,
          galleryImages: true,
          duration: true,
          isFeatured: true,
          createdAt: true,
          serviceCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
              mobileIcon: true,
            },
          },
          seller: {
            select: {
              id: true,
              userId: true,
              store: {
                select: {
                  name: true,
                  logo: true,
                  city: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              orderItems: true,
            },
          },
        },
      }),
    ])

    // Calculate ratings
    const serviceIds = rawServices.map((s) => s.id)
    const ratingRows =
      serviceIds.length > 0
        ? await prisma.review.groupBy({
            by: ["serviceId"],
            where: { serviceId: { in: serviceIds } },
            _avg: { rating: true },
          })
        : []

    const ratingMap: Record<string, number> = {}
    ratingRows.forEach((r) => {
      if (r.serviceId) {
        ratingMap[r.serviceId] = Number(r._avg.rating || 0)
      }
    })

    let services = rawServices.map((s) => ({
      ...s,
      rating: ratingMap[s.id] || 0, // 0 if unreviewed
      averageRating: ratingMap[s.id] || 0,
      reviewCount: s._count.reviews || 0,
      reviewsCount: s._count.reviews || 0,
      totalReviews: s._count.reviews || 0,
      totalRatings: s._count.reviews || 0,
      bookingsCount: s._count.orderItems || 0,
    }))

    // Filter by min rating if requested
    if (minRating !== undefined && !isNaN(minRating)) {
      services = services.filter((s) => s.rating >= minRating)
    }

    // Sort by rating or popularity if requested
    if (sortBy === "rating") {
      services.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === "popular") {
      services.sort((a, b) => b.bookingsCount - a.bookingsCount)
    }

    // Randomize on default view (no search, no explicit sort) — skip/take handled via oversample+slice
    const finalServices = isDefaultView
      ? shuffleArray(services).slice(0, limit)
      : services

    // Fetch active service banners for the header carousel
    const rawBanners = await prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ targetType: "service" }, { serviceCategoryId: { not: null } }],
      },
      take: 12,
      orderBy: { createdAt: "desc" },
    })
    const banners = shuffleArray(rawBanners)

    return NextResponse.json(
      {
        success: true,
        services: finalServices,
        banners,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error: any) {
    console.error("Public services API error:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}
