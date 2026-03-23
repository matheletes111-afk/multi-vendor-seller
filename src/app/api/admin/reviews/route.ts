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
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = {
    OR: [{ productId: { not: null } }, { serviceId: { not: null } }],
  }

  const allItemRows = await prisma.review.findMany({
    where,
    select: { productId: true, serviceId: true },
    distinct: ["productId", "serviceId"],
  })

  const totalCount = allItemRows.length
  const totalPages = Math.ceil(totalCount / perPage) || 1

  const groups = await prisma.review.groupBy({
    by: ["productId", "serviceId"],
    where,
    _avg: { rating: true },
    _count: true,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip,
    take,
  })

  const productIds = groups.map((g) => g.productId).filter((v): v is string => typeof v === "string")
  const serviceIds = groups.map((g) => g.serviceId).filter((v): v is string => typeof v === "string")

  const [products, services] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, images: true } })
      : Promise.resolve([] as Array<{ id: string; name: string; images: unknown }>),
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, images: true } })
      : Promise.resolve([] as Array<{ id: string; name: string; images: unknown }>),
  ])

  const productMetaMap = Object.fromEntries(
    products.map((p) => [p.id, { name: p.name, image: firstImageFromJson(p.images) }])
  )
  const serviceMetaMap = Object.fromEntries(
    services.map((s) => [s.id, { name: s.name, image: firstImageFromJson(s.images) }])
  )

  return NextResponse.json({
    groups: groups
      .map((g) => {
        const isProduct = typeof g.productId === "string" && g.productId.length > 0
        const itemType = isProduct ? "product" : "service"
        const itemId = (isProduct ? g.productId : g.serviceId) as string | null
        if (!itemId) return null
      const itemName = isProduct
        ? productMetaMap[itemId]?.name ?? "Product"
        : serviceMetaMap[itemId]?.name ?? "Service"
      const itemImage = isProduct
        ? productMetaMap[itemId]?.image ?? null
        : serviceMetaMap[itemId]?.image ?? null
      return {
        itemType,
        itemId,
        itemName,
        itemImage,
        avgRating: g._avg.rating ?? 0,
        reviewCount: g._count,
        latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
      }
      })
      .filter((x): x is NonNullable<typeof x> => x != null),
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

