import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET /api/home/services — public list of active services for home carousel */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get("limit") ?? "12")
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 30) : 12
    const serviceCategoryId = searchParams.get("serviceCategoryId") ?? undefined

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        ...(serviceCategoryId ? { serviceCategoryId } : {}),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        basePrice: true,
        discount: true,
        images: true,
        serviceCategory: { select: { id: true, name: true, slug: true } },
        seller: { select: { store: { select: { name: true } } } },
        _count: { select: { reviews: true } },
      },
    })

    const serviceIds = services.map((s) => s.id)
    const ratingRows = serviceIds.length > 0
      ? await prisma.review.groupBy({
          by: ["serviceId"],
          where: { serviceId: { in: serviceIds } },
          _avg: { rating: true },
        })
      : []

    const ratingByService = Object.fromEntries(
      ratingRows.map((r) => [r.serviceId, Number(r._avg.rating ?? 0)])
    ) as Record<string, number>

    const serialized = services.map((s) => ({
      ...s,
      averageRating: ratingByService[s.id] ?? 0,
    }))

    return NextResponse.json(serialized)
  } catch (error) {
    console.error("Home services API error:", error)
    return NextResponse.json([], { status: 500 })
  }
}
