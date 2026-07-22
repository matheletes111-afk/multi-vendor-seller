import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function extractImageUrls(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((value): value is string => typeof value === "string")
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string")
    } catch {
      return []
    }
  }
  return []
}

function getShippingChargeForWeight(weight: number, ranges: any[]): number {
  if (!ranges || ranges.length === 0) return 0
  const w = typeof weight === "number" && !isNaN(weight) ? Math.max(0, weight) : 0
  for (const r of ranges) {
    const minW = Number(r.minWeight ?? 0)
    const maxW = Number(r.maxWeight ?? 0)
    const charge = Number(r.charge ?? 0)
    if (w >= minW && w < maxW) {
      return charge
    }
  }
  const firstMin = Number(ranges[0]?.minWeight ?? 0)
  if (w <= firstMin) {
    return Number(ranges[0]?.charge ?? 0)
  }
  return Number(ranges[ranges.length - 1]?.charge ?? 0)
}

/** GET single product by id. Public (no auth) for product detail page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [product, ratingAgg, globalSetting] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true },
      include: {
        category: true,
        seller: { include: { store: true } },
        variants: true,
        _count: { select: { reviews: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            isVerified: true,
            user: { select: { name: true, image: true } },
          },
        },
      },
    }),
    prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
    }),
    prisma.globalSetting.findFirst(),
  ])
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const ranges = (globalSetting?.deliveryChargeRanges as any[]) || []
  const weight = product.variants?.[0]?.weight ?? 0
  const estimatedDeliveryCharge = getShippingChargeForWeight(weight, ranges)

  const reviews = product.reviews.map((review) => {
    const safeName = (review.user?.name || "").trim()
    const reviewerName = safeName ? safeName.split(/\s+/)[0] : "Verified buyer"
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      images: extractImageUrls(review.images),
      createdAt: review.createdAt.toISOString(),
      isVerified: review.isVerified,
      reviewerName,
      reviewerImage: typeof review.user?.image === "string" && review.user.image.trim().length > 0 ? review.user.image : null,
    }
  })

  return NextResponse.json({
    ...product,
    averageRating: Number(ratingAgg._avg.rating ?? 0),
    reviews,
    estimatedDeliveryCharge,
  })
}
