import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"

export const dynamic = 'force-dynamic'

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

/** 
 * GET /mobileapi/product-seller/reviews/[id]
 * Detailed list of reviews for a specific product.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: productId } = await params
    if (!productId) return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 })

    const [product, agg, reviews] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, images: true } }),
      prisma.review.aggregate({
        where: { productId, product: { sellerId: seller.id } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.review.findMany({
        where: { productId, product: { sellerId: seller.id } },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, image: true } },
          orderItem: {
            select: {
              order: { select: { orderNumber: true, seller: { select: { store: { select: { name: true } } } } } },
              productNameSnapshot: true,
              productVariant: { select: { name: true, attributes: true } }
            },
          },
        },
      }),
    ])

    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        productImage: toImageArray(product.images).at(0) ?? null,
        avgRating: Number(agg._avg.rating ?? 0).toFixed(1),
        reviewCount: agg._count._all,
        reviews: reviews.map((row) => {
          let variantInfo = row.orderItem?.productVariant?.name || ""
          const attrs = row.orderItem?.productVariant?.attributes as Record<string, any>
          if (attrs && typeof attrs === 'object') {
            const attrStrings = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`)
            if (attrStrings.length > 0) variantInfo = attrStrings.join(", ")
          }

          return {
            id: row.id,
            rating: row.rating,
            comment: row.comment,
            images: toImageArray(row.images),
            createdAt: row.createdAt.toISOString(),
            isVerified: row.isVerified,
            customerName: row.user?.name ?? "Verified buyer",
            customerEmail: row.user?.email ?? null,
            customerImage: row.user?.image ?? null,
            orderNumber: row.orderItem?.order?.orderNumber ?? null,
            sellerStoreName: row.orderItem?.order?.seller?.store?.name ?? null,
            variantInfo
          }
        }),
      }
    })
  } catch (error) {
    console.error("Mobile product seller review details API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
