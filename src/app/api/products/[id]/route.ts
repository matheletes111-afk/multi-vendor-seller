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

/** GET single product by id. Public (no auth) for product detail page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [product, ratingAgg] = await Promise.all([
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
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
    }),
  ])
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

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
    }
  })

  return NextResponse.json({
    ...product,
    averageRating: Number(ratingAgg._avg.rating ?? 0),
    reviews,
  })
}
