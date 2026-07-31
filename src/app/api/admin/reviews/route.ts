import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

function firstImageFromJson(images: unknown): string | null {
  if (Array.isArray(images)) {
    const first = images.find((v): v is string => typeof v === "string" && v.trim().length > 0)
    return first ?? null
  }
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images) as unknown
      if (Array.isArray(parsed)) {
        const first = parsed.find((v): v is string => typeof v === "string" && v.trim().length > 0)
        return first ?? null
      }
    } catch {
      return null
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tab = (searchParams.get("tab") || "product").toLowerCase()
  const search = searchParams.get("search")?.trim() || ""

  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  if (tab === "hotel") {
    // Hotel Reviews
    const whereCondition = search
      ? { hotel: { name: { contains: search, mode: "insensitive" as const } } }
      : {}

    const allHotelRows = await prisma.hotelReview.findMany({
      where: whereCondition,
      select: { hotelId: true },
      distinct: ["hotelId"],
    })
    const totalCount = allHotelRows.length
    const totalPages = Math.ceil(totalCount / perPage) || 1

    const groups = await prisma.hotelReview.groupBy({
      by: ["hotelId"],
      where: whereCondition,
      _avg: { rating: true },
      _count: true,
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      skip,
      take,
    })

    const hotelIds = groups.map((g) => g.hotelId)
    const hotels = hotelIds.length
      ? await prisma.hotel.findMany({
          where: { id: { in: hotelIds } },
          select: { id: true, name: true, images: true },
        })
      : []

    const hotelMap = Object.fromEntries(
      hotels.map((h) => [h.id, { name: h.name, image: firstImageFromJson(h.images) }])
    )

    const resultGroups = groups.map((g) => ({
      itemType: "hotel" as const,
      itemId: g.hotelId,
      itemName: hotelMap[g.hotelId]?.name ?? "Hotel",
      itemImage: hotelMap[g.hotelId]?.image ?? null,
      avgRating: g._avg.rating ?? 0,
      reviewCount: g._count,
      latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    }))

    return NextResponse.json({ groups: resultGroups, totalCount, totalPages, page, perPage, tab: "hotel" })
  }

  if (tab === "restaurant") {
    // Restaurant / Food Reviews
    const whereCondition = search
      ? { foodItem: { name: { contains: search, mode: "insensitive" as const } } }
      : {}

    const allFoodRows = await prisma.foodReview.findMany({
      where: whereCondition,
      select: { foodItemId: true },
      distinct: ["foodItemId"],
    })
    const totalCount = allFoodRows.length
    const totalPages = Math.ceil(totalCount / perPage) || 1

    const groups = await prisma.foodReview.groupBy({
      by: ["foodItemId"],
      where: whereCondition,
      _avg: { rating: true },
      _count: true,
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      skip,
      take,
    })

    const foodIds = groups.map((g) => g.foodItemId)
    const foods = foodIds.length
      ? await prisma.foodItem.findMany({
          where: { id: { in: foodIds } },
          select: { id: true, name: true, images: true },
        })
      : []

    const foodMap = Object.fromEntries(
      foods.map((f) => [f.id, { name: f.name, image: firstImageFromJson(f.images) }])
    )

    const resultGroups = groups.map((g) => ({
      itemType: "food" as const,
      itemId: g.foodItemId,
      itemName: foodMap[g.foodItemId]?.name ?? "Food Item",
      itemImage: foodMap[g.foodItemId]?.image ?? null,
      avgRating: g._avg.rating ?? 0,
      reviewCount: g._count,
      latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    }))

    return NextResponse.json({ groups: resultGroups, totalCount, totalPages, page, perPage, tab: "restaurant" })
  }

  if (tab === "service") {
    // Service Reviews
    const whereCondition: any = {
      serviceId: { not: null },
    }
    if (search) {
      whereCondition.service = { name: { contains: search, mode: "insensitive" as const } }
    }

    const allServiceRows = await prisma.review.findMany({
      where: whereCondition,
      select: { serviceId: true },
      distinct: ["serviceId"],
    })
    const totalCount = allServiceRows.length
    const totalPages = Math.ceil(totalCount / perPage) || 1

    const groups = await prisma.review.groupBy({
      by: ["serviceId"],
      where: whereCondition,
      _avg: { rating: true },
      _count: true,
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      skip,
      take,
    })

    const serviceIds = groups.map((g) => g.serviceId).filter((v): v is string => typeof v === "string")
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, images: true },
        })
      : []

    const serviceMap = Object.fromEntries(
      services.map((s) => [s.id, { name: s.name, image: firstImageFromJson(s.images) }])
    )

    const resultGroups = groups.map((g) => ({
      itemType: "service" as const,
      itemId: g.serviceId!,
      itemName: serviceMap[g.serviceId!]?.name ?? "Service",
      itemImage: serviceMap[g.serviceId!]?.image ?? null,
      avgRating: g._avg.rating ?? 0,
      reviewCount: g._count,
      latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    }))

    return NextResponse.json({ groups: resultGroups, totalCount, totalPages, page, perPage, tab: "service" })
  }

  // Default: Product Reviews
  const whereCondition: any = {
    productId: { not: null },
  }
  if (search) {
    whereCondition.product = { name: { contains: search, mode: "insensitive" as const } }
  }

  const allProductRows = await prisma.review.findMany({
    where: whereCondition,
    select: { productId: true },
    distinct: ["productId"],
  })
  const totalCount = allProductRows.length
  const totalPages = Math.ceil(totalCount / perPage) || 1

  const groups = await prisma.review.groupBy({
    by: ["productId"],
    where: whereCondition,
    _avg: { rating: true },
    _count: true,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip,
    take,
  })

  const productIds = groups.map((g) => g.productId).filter((v): v is string => typeof v === "string")
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, images: true },
      })
    : []

  const productMap = Object.fromEntries(
    products.map((p) => [p.id, { name: p.name, image: firstImageFromJson(p.images) }])
  )

  const resultGroups = groups.map((g) => ({
    itemType: "product" as const,
    itemId: g.productId!,
    itemName: productMap[g.productId!]?.name ?? "Product",
    itemImage: productMap[g.productId!]?.image ?? null,
    avgRating: g._avg.rating ?? 0,
    reviewCount: g._count,
    latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
  }))

  return NextResponse.json({ groups: resultGroups, totalCount, totalPages, page, perPage, tab: "product" })
}
