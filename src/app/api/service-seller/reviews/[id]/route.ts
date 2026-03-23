import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"

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

/** GET /api/service-seller/reviews/[id] — all reviews for one service (for current seller). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: serviceId } = await params
  if (!serviceId || serviceId === "undefined" || serviceId === "null") {
    return NextResponse.json({ error: "Invalid service id" }, { status: 400 })
  }

  const [service, agg, reviews] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, name: true, images: true } }),
    prisma.review.aggregate({
      where: { serviceId, service: { sellerId: seller.id } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { serviceId, service: { sellerId: seller.id } },
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

  const avgRating = agg._avg.rating ?? 0
  const reviewCount = agg._count._all ?? 0

  return NextResponse.json({
    serviceId,
    productId: null,
    serviceName: service?.name ?? "Service",
    serviceImage: toImageArray(service?.images).at(0) ?? null,
    avgRating,
    reviewCount,
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

