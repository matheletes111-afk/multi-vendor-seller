import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { activeProductSellerWhere } from "@/lib/subscriptions"
import { getRequestPublicOrigin, toPublicMediaUrl, toPublicMediaUrlList } from "@/lib/media-url"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const origin = getRequestPublicOrigin(request)

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Product ID is required"
      }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { 
        id, 
        isActive: true,
        isDeleted: false,
        seller: activeProductSellerWhere(),
      },
      include: {
        category: true,
        seller: { 
          include: { 
            store: true 
          } 
        },
        variants: true,
        sellerAds: true,
        _count: { 
          select: { 
            reviews: true 
          } 
        },
      },
    })

    if (!product) {
      return NextResponse.json({
        success: false,
        error: "Product not found"
      }, { status: 404 })
    }

    const firstVariantAttrs = (product.variants?.[0]?.attributes as Record<string, unknown>) || {}
    const brand = typeof (firstVariantAttrs.brand ?? firstVariantAttrs.Brand ?? firstVariantAttrs.BRAND) === "string"
      ? String(firstVariantAttrs.brand ?? firstVariantAttrs.Brand ?? firstVariantAttrs.BRAND).trim() || null
      : null

    const cleanVariants = product.variants.map((v) => {
      const deliveryDays = v.deliveryDays ?? 7
      const base = {
        ...v,
        images: toPublicMediaUrlList(v.images, origin),
        deliveryDays,
        delivery_days: deliveryDays,
        estimated_delivery_days: deliveryDays,
      }
      if (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
        const attrs = { ...(v.attributes as Record<string, unknown>) }
        delete attrs.brand
        delete attrs.Brand
        delete attrs.BRAND
        return {
          ...base,
          attributes: attrs,
        }
      }
      return base
    })

    const [ratingAgg] = await Promise.all([
      prisma.review.aggregate({
        where: { productId: id },
        _avg: { rating: true },
      }),
    ])

    const averageRating = parseFloat(Number(ratingAgg._avg.rating ?? 0).toFixed(1))
    const reviewsCount = product._count?.reviews ?? 0

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        images: toPublicMediaUrlList(product.images, origin),
        seller: product.seller
          ? {
              ...product.seller,
              store: product.seller.store
                ? {
                    ...product.seller.store,
                    logo: toPublicMediaUrl(product.seller.store.logo, origin),
                  }
                : product.seller.store,
            }
          : product.seller,
        sellerAds: (product.sellerAds || []).map((ad) => ({
          ...ad,
          creativeUrl: toPublicMediaUrl(ad.creativeUrl, origin),
          mobileCreativeUrl: toPublicMediaUrl(ad.mobileCreativeUrl, origin),
        })),
        variants: cleanVariants,
        brand,
        averageRating,
        totalRatings: reviewsCount,
        reviewsCount,
        totalReviews: reviewsCount,
      }
    } as any)

  } catch (error) {
    console.error("Product API error:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error"
    }, { status: 500 })
  }
}