import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shuffleArray } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface ProductItem {
  id: string
  name: string
  slug: string
  images: string[]
  category: { id: string; name: string; slug: string }
  basePrice: number
  discount: number
}

interface BestSellerItem {
  sellerId: string
  storeName: string
  totalActiveProducts: number
  products: ProductItem[]
}

type SuccessResponse = {
  success: true
  message: string
  data: {
    count: number
    sellers: BestSellerItem[]
  }
}

type ErrorResponse = {
  success: false
  error: string
}

/** GET /mobileapi/home/best-sellers?limitSellers=2&productsPerSeller=10 */
export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const params = request.nextUrl.searchParams
    const limitSellers = Math.min(Math.max(Number(params.get("limitSellers")) || 2, 1), 10)
    const productsPerSeller = Math.min(Math.max(Number(params.get("productsPerSeller")) || 10, 1), 20)

    const candidateGrouped = await prisma.product.groupBy({
      by: ["sellerId"],
      where: {
        isActive: true,
        isDeleted: false,
        seller: {
          isApproved: true,
          isSuspended: false,
        },
      },
      _count: { _all: true },
      orderBy: { _count: { sellerId: "desc" } },
      take: 20,
    })

    const grouped = shuffleArray(candidateGrouped).slice(0, limitSellers)


    if (grouped.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "Best sellers fetched successfully",
          data: { count: 0, sellers: [] },
        },
        { status: 200 }
      )
    }

    const sellers = await Promise.all(
      grouped.map(async (g) => {
        const seller = await prisma.seller.findUnique({
          where: { id: g.sellerId },
          select: { id: true, store: { select: { name: true } } },
        })

        const candidateProducts = await prisma.product.findMany({
          where: { isActive: true, isDeleted: false, sellerId: g.sellerId },
          take: Math.max(productsPerSeller * 3, 20),
          select: {
            id: true,
            name: true,
            slug: true,
            images: true,
            category: { select: { id: true, name: true, slug: true } },
            variants: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { price: true, discount: true },
            },
          },
        })

        const products = shuffleArray(candidateProducts).slice(0, productsPerSeller)


        const serializedProducts: ProductItem[] = products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          images: (p.images as string[]) || [],
          category: p.category,
          basePrice: p.variants[0]?.price ?? 0,
          discount: p.variants[0]?.discount ?? 0,
        }))

        return {
          sellerId: g.sellerId,
          storeName: seller?.store?.name ?? "Store",
          totalActiveProducts: g._count._all,
          products: serializedProducts,
        } satisfies BestSellerItem
      })
    )

    return NextResponse.json(
      {
        success: true,
        message: "Best sellers fetched successfully",
        data: { count: sellers.length, sellers },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Mobile home best-sellers API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

