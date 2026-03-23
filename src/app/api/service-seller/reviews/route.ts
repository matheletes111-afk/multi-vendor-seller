import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
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
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = {
    service: { sellerId: seller.id },
    serviceId: { not: null },
  }

  const allServiceIdRows = await prisma.review.findMany({
    where,
    select: { serviceId: true },
    distinct: ["serviceId"],
  })
  const totalCount = allServiceIdRows.length
  const totalPages = Math.ceil(totalCount / perPage) || 1

  const groups = await prisma.review.groupBy({
    by: ["serviceId"],
    where,
    _avg: { rating: true },
    _count: true,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip,
    take,
  })

  const nonNullGroups = groups.filter((g) => typeof g.serviceId === "string")
  const serviceIds = nonNullGroups.map((g) => g.serviceId)
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true, images: true },
  })
  const serviceMetaMap = Object.fromEntries(
    services.map((s) => [s.id, { name: s.name, image: firstImageFromJson(s.images) }])
  )

  return NextResponse.json({
    groups: nonNullGroups.map((g) => ({
      serviceId: g.serviceId,
      serviceName: serviceMetaMap[g.serviceId]?.name ?? "Service",
      serviceImage: serviceMetaMap[g.serviceId]?.image ?? null,
      avgRating: g._avg.rating ?? 0,
      reviewCount: g._count,
      latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    })),
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

