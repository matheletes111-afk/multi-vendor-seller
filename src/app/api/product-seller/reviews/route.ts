import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
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
  if (!session?.user || !isProductSeller(session.user)) {
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
    product: { sellerId: seller.id },
    productId: { not: null },
  }

  // Count distinct products for pagination.
  const allProductIdRows = await prisma.review.findMany({
    where,
    select: { productId: true },
    distinct: ["productId"],
  })
  const totalCount = allProductIdRows.length
  const totalPages = Math.ceil(totalCount / perPage) || 1

  const groups = await prisma.review.groupBy({
    by: ["productId"],
    where,
    _avg: { rating: true },
    _count: true,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip,
    take,
  })

  const nonNullGroups = groups.filter((g) => typeof g.productId === "string")
  const productIds = nonNullGroups
    .map((g) => g.productId)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, images: true },
  })
  const productMetaMap = Object.fromEntries(
    products.map((p) => [p.id, { name: p.name, image: firstImageFromJson(p.images) }])
  )

  return NextResponse.json({
    groups: nonNullGroups
      .map((g) => {
        const productId = g.productId
        if (typeof productId !== "string" || productId.length === 0) return null
        return {
          productId,
          productName: productMetaMap[productId]?.name ?? "Product",
          productImage: productMetaMap[productId]?.image ?? null,
          avgRating: g._avg.rating ?? 0,
          reviewCount: g._count,
          latestReviewAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null),
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

