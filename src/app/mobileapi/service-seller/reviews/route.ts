import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"

export const dynamic = 'force-dynamic'

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

/**
 * GET /mobileapi/service-seller/reviews
 * Returns a list of services that have reviews.
 */
export async function GET(request: NextRequest) {
  const authStatus = getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId: authStatus.userId },
      select: { id: true },
    })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const perPage = parseInt(searchParams.get("perPage") || "10")
    const skip = (page - 1) * perPage

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
      take: perPage,
    })

    const nonNullGroups = groups.filter((g) => typeof g.serviceId === "string")
    const serviceIds = nonNullGroups
      .map((g) => g.serviceId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
    
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, images: true },
    })
    
    const serviceMetaMap = Object.fromEntries(
      services.map((s) => [s.id, { name: s.name, image: firstImageFromJson(s.images) }])
    )

    const data = nonNullGroups
      .map((g) => {
        const serviceId = g.serviceId
        if (typeof serviceId !== "string" || serviceId.length === 0) return null
        return {
          serviceId,
          serviceName: serviceMetaMap[serviceId]?.name ?? "Service",
          serviceImage: serviceMetaMap[serviceId]?.image ?? null,
          avgRating: Number(g._avg.rating ?? 0).toFixed(1),
          reviewCount: g._count,
          latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        totalCount,
        totalPages,
        page,
        perPage,
      }
    })
  } catch (error) {
    console.error("Mobile service seller review list API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
