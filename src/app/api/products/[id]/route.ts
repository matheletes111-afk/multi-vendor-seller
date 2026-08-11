import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateShippingBreakup } from "@/lib/shipping-calculator"

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
  const [product, ratingAgg, globalSetting] = await Promise.all([
    prisma.product.findFirst({
      where: { id, isActive: true, isDeleted: false, seller: { isApproved: true, isSuspended: false } },
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
    prisma.globalSetting.findFirst({ select: { deliveryChargeRanges: true, dimensionDeliveryChargeRanges: true, regionDeliveryCharges: true } }).catch(() => null),
  ])
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const weightRanges = (globalSetting?.deliveryChargeRanges as any[]) || []
  const dimensionRanges = (globalSetting?.dimensionDeliveryChargeRanges as any[]) || []
  const regionCharges = (globalSetting?.regionDeliveryCharges as any[]) || []
  
  const variant = product.variants?.[0]

  const shippingBreakup = calculateShippingBreakup({
    items: [
      {
        weight: variant?.weight ?? 0,
        height: variant?.height ?? 0,
        width: variant?.width ?? 0,
        depth: variant?.depth ?? 0,
        quantity: 1,
        isPhysical: true,
      },
    ],
    weightRanges,
    dimensionRanges,
    regionCharges,
  })

  const estimatedDeliveryCharge = shippingBreakup.totalShippingFee

  // Fetch related products from same category
  const relatedProductsRaw = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: id },
      isActive: true,
      isDeleted: false,
    },
    take: 8,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      seller: { include: { store: true } },
      variants: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const relatedProducts = relatedProductsRaw.map((p) => {
    const v0 = p.variants?.[0]
    const basePrice = v0?.price ?? 0
    const discount = v0?.discount ?? 0
    const finalPrice = Math.max(0, basePrice - discount)
    return {
      id: p.id,
      name: p.name,
      images: p.images,
      basePrice,
      discount,
      finalPrice,
      category: p.category,
      seller: p.seller,
      _count: p._count,
    }
  })

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
    relatedProducts,
  })
}
