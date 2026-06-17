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
 * GET /mobileapi/product-seller/reviews
 * Returns a list of products that have reviews.
 */
export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
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
      take: perPage,
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

    const data = nonNullGroups
      .map((g) => {
        const productId = g.productId
        if (typeof productId !== "string" || productId.length === 0) return null
        return {
          productId,
          productName: productMetaMap[productId]?.name ?? "Product",
          productImage: productMetaMap[productId]?.image ?? null,
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
    console.error("Mobile product seller review list API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
