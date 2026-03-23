import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

function toImageArray(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((v): v is string => typeof v === "string")
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images) as unknown
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
    } catch {
      /* ignore */
    }
  }
  return []
}

type ReviewType = "product" | "service"

/** GET /api/admin/reviews/[type]/[id] — all reviews for one product/service. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = await params
  const reviewType = type === "product" || type === "service" ? (type as ReviewType) : null
  if (!reviewType) return NextResponse.json({ error: "Invalid review type" }, { status: 400 })
  if (!id || id === "undefined" || id === "null") {
    return NextResponse.json({ error: "Invalid review item id" }, { status: 400 })
  }

  const where =
    reviewType === "product"
      ? { productId: id }
      : { serviceId: id }

  const [item, agg, reviews] = await Promise.all([
    reviewType === "product"
      ? prisma.product.findUnique({ where: { id }, select: { id: true, name: true, images: true } })
      : prisma.service.findUnique({ where: { id }, select: { id: true, name: true, images: true } }),
    prisma.review.aggregate({
      where,
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, image: true } },
        orderItem: {
          select: {
            order: { select: { orderNumber: true, seller: { select: { store: { select: { name: true } } } } } },
            productNameSnapshot: true,
            serviceNameSnapshot: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    reviewType,
    itemId: id,
    itemName: item?.name ?? (reviewType === "product" ? "Product" : "Service"),
    itemImage: toImageArray(item?.images).at(0) ?? null,
    avgRating: agg._avg.rating ?? 0,
    reviewCount: agg._count._all ?? 0,
    reviews: reviews.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      images: toImageArray(row.images),
      createdAt: row.createdAt.toISOString(),
      isVerified: row.isVerified,
      customerName: row.user?.name ?? null,
      customerEmail: row.user?.email ?? null,
      customerImage: row.user?.image ?? null,
      orderNumber: row.orderItem?.order?.orderNumber ?? null,
      sellerStoreName: row.orderItem?.order?.seller?.store?.name ?? null,
    })),
  })
}

