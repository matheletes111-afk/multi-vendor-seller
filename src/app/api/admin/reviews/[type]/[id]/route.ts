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

type ReviewType = "product" | "service" | "hotel" | "food" | "restaurant"

/** GET /api/admin/reviews/[type]/[id] — all reviews for one item (product/service/hotel/food). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = await params
  const normalizedType = type === "restaurant" ? "food" : type
  const reviewType = (["product", "service", "hotel", "food"].includes(normalizedType)
    ? normalizedType
    : null) as ReviewType | null

  if (!reviewType) return NextResponse.json({ error: "Invalid review type" }, { status: 400 })
  if (!id || id === "undefined" || id === "null") {
    return NextResponse.json({ error: "Invalid review item id" }, { status: 400 })
  }

  if (reviewType === "hotel") {
    const [hotel, agg, reviews] = await Promise.all([
      prisma.hotel.findUnique({ where: { id }, select: { id: true, name: true, images: true } }),
      prisma.hotelReview.aggregate({
        where: { hotelId: id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.hotelReview.findMany({
        where: { hotelId: id },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, image: true } },
        },
      }),
    ])

    return NextResponse.json({
      reviewType: "hotel",
      itemId: id,
      itemName: hotel?.name ?? "Hotel",
      itemImage: toImageArray(hotel?.images).at(0) ?? null,
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count._all ?? 0,
      reviews: reviews.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        images: toImageArray(row.images),
        createdAt: row.createdAt.toISOString(),
        isVerified: true,
        customerName: row.user?.name ?? null,
        customerEmail: row.user?.email ?? null,
        customerImage: row.user?.image ?? null,
        orderNumber: null,
        sellerStoreName: null,
      })),
    })
  }

  if (reviewType === "food") {
    const [foodItem, agg, reviews] = await Promise.all([
      prisma.foodItem.findUnique({ where: { id }, select: { id: true, name: true, images: true } }),
      prisma.foodReview.aggregate({
        where: { foodItemId: id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.foodReview.findMany({
        where: { foodItemId: id },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, image: true } },
        },
      }),
    ])

    return NextResponse.json({
      reviewType: "food",
      itemId: id,
      itemName: foodItem?.name ?? "Food Item",
      itemImage: toImageArray(foodItem?.images).at(0) ?? null,
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count._all ?? 0,
      reviews: reviews.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        images: toImageArray(row.images),
        createdAt: row.createdAt.toISOString(),
        isVerified: true,
        customerName: row.user?.name ?? null,
        customerEmail: row.user?.email ?? null,
        customerImage: row.user?.image ?? null,
        orderNumber: null,
        sellerStoreName: null,
      })),
    })
  }

  // Product or Service
  const where = reviewType === "product" ? { productId: id } : { serviceId: id }

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
